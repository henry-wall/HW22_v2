import { useEffect, useState, useRef, useCallback } from "react";
import { useStorage } from "../services/storage/StorageContext";

export type SyncStatus = "loading" | "saved" | "saving" | "error" | "offline";

interface UseTournamentStateReturn<T extends Record<string, any>> {
    data: T;
    updateField: <K extends keyof T>(field: K, value: T[K]) => void;
    updateData: (partial: Partial<T>) => void;
    replaceData: (full: T) => void;
    syncStatus: SyncStatus;
    lastSavedAt: Date | null;
    isLoaded: boolean;
    errorMessage: string | null;
}

/**
 * Unified tournament state hook.
 * Saves the entire tournament as a single JSON object, with:
 * - Loading gate: won't expose default values until cloud load completes
 * - Debounced saves (500ms): groups rapid edits into one save
 * - Sync status tracking: loading / saving / saved / error / offline
 * - Automatic localStorage fallback on save failure
 * - Real-time subscription for cross-device sync
 */
export function useTournamentState<T extends Record<string, any>>(
    key: string,
    defaultValue: T
): UseTournamentStateReturn<T> {
    const { service, mode } = useStorage();

    const [data, setData] = useState<T>(defaultValue);
    const [syncStatus, setSyncStatus] = useState<SyncStatus>("loading");
    const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Refs to avoid stale closures in effects
    const dataRef = useRef<T>(data);
    const isLoadedRef = useRef(false);
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isSavingRef = useRef(false);
    const pendingSaveRef = useRef(false);
    const lastSavedJsonRef = useRef<string>("");
    // Track if we are currently applying a remote update to avoid re-saving it
    const isApplyingRemoteRef = useRef(false);

    // Keep dataRef in sync
    useEffect(() => {
        dataRef.current = data;
    }, [data]);

    // ─── LOAD ───────────────────────────────────────────────
    useEffect(() => {
        let mounted = true;
        isLoadedRef.current = false;
        setIsLoaded(false);
        setSyncStatus("loading");

        async function load() {
            try {
                const loaded = await service.load<T>(key, defaultValue);
                if (!mounted) return;

                const loadedJson = JSON.stringify(loaded);
                setData(loaded);
                dataRef.current = loaded;
                lastSavedJsonRef.current = loadedJson;
                isLoadedRef.current = true;
                setIsLoaded(true);
                setSyncStatus("saved");
            } catch (err: any) {
                console.error(`[useTournamentState] Error loading key "${key}":`, err);
                if (!mounted) return;

                setErrorMessage(err.message || "Erro desconhecido ao carregar");

                // Try localStorage fallback
                try {
                    const fallback = window.localStorage.getItem(key);
                    if (fallback) {
                        const parsed = JSON.parse(fallback) as T;
                        setData(parsed);
                        dataRef.current = parsed;
                        lastSavedJsonRef.current = JSON.stringify(parsed);
                    }
                } catch {
                    // Use default if even fallback fails
                }

                isLoadedRef.current = true;
                setIsLoaded(true);
                setSyncStatus(mode === "cloud" ? "offline" : "saved");
            }
        }

        load();

        return () => {
            mounted = false;
        };
    }, [service, key]); // Re-load when service changes (local↔cloud switch)

    // ─── SUBSCRIBE TO REMOTE CHANGES ───────────────────────
    useEffect(() => {
        const unsubscribe = service.subscribe<T>(key, (newValue) => {
            if (!isLoadedRef.current) return; // Ignore updates before initial load

            const newJson = JSON.stringify(newValue);
            // Only apply if actually different from what we have
            if (newJson !== JSON.stringify(dataRef.current)) {
                isApplyingRemoteRef.current = true;
                setData(newValue);
                dataRef.current = newValue;
                lastSavedJsonRef.current = newJson;
                // Clear the flag after React processes the state update
                setTimeout(() => {
                    isApplyingRemoteRef.current = false;
                }, 50);
            }
        });

        return () => {
            unsubscribe();
        };
    }, [service, key]);

    // ─── DEBOUNCED SAVE ─────────────────────────────────────
    const debouncedSave = useCallback(
        (newData: T) => {
            if (!isLoadedRef.current) return; // Never save before load completes

            // Clear any pending save
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }

            const newJson = JSON.stringify(newData);
            // Don't save if nothing changed
            if (newJson === lastSavedJsonRef.current) return;

            setSyncStatus("saving");

            saveTimeoutRef.current = setTimeout(async () => {
                if (isSavingRef.current) {
                    // Another save is in progress, mark as pending
                    pendingSaveRef.current = true;
                    return;
                }

                isSavingRef.current = true;
                const dataToSave = dataRef.current;
                const jsonToSave = JSON.stringify(dataToSave);

                try {
                    await service.save(key, dataToSave);
                    lastSavedJsonRef.current = jsonToSave;
                    setLastSavedAt(new Date());
                    setSyncStatus("saved");

                    // Also save to localStorage as backup (if in cloud mode)
                    if (mode === "cloud") {
                        try {
                            window.localStorage.setItem(`${key}_backup`, jsonToSave);
                        } catch {
                            // localStorage full, ignore
                        }
                    }
                } catch (err: any) {
                    console.error(`[useTournamentState] Error saving key "${key}":`, err);
                    setSyncStatus("error");
                    setErrorMessage(err.message || "Erro desconhecido ao salvar");

                    // Fallback: save to localStorage
                    try {
                        window.localStorage.setItem(key, jsonToSave);
                    } catch {
                        // Last resort failed too
                    }
                } finally {
                    isSavingRef.current = false;

                    // If there was a pending save, trigger it now
                    if (pendingSaveRef.current) {
                        pendingSaveRef.current = false;
                        debouncedSave(dataRef.current);
                    }
                }
            }, 500); // 500ms debounce
        },
        [service, key, mode]
    );

    // ─── TRIGGER SAVE ON DATA CHANGE ───────────────────────
    useEffect(() => {
        // Don't save if:
        // 1. Not loaded yet
        // 2. This change came from a remote subscription
        if (!isLoadedRef.current) return;
        if (isApplyingRemoteRef.current) return;

        debouncedSave(data);
    }, [data, debouncedSave]);

    // ─── CLEANUP TIMEOUT ON UNMOUNT ────────────────────────
    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
                // Force save immediately on unmount if there's pending data
                if (isLoadedRef.current) {
                    const finalJson = JSON.stringify(dataRef.current);
                    if (finalJson !== lastSavedJsonRef.current) {
                        service.save(key, dataRef.current).catch(console.error);
                        if (mode === "cloud") {
                            try {
                                window.localStorage.setItem(`${key}_backup`, finalJson);
                            } catch { }
                        }
                    }
                }
            }
        };
    }, [service, key, mode]);

    // ─── PUBLIC API ────────────────────────────────────────
    const updateField = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
        setData((prev) => {
            const updated = { ...prev, [field]: value };
            dataRef.current = updated;
            return updated;
        });
    }, []);

    const updateData = useCallback((partial: Partial<T>) => {
        setData((prev) => {
            const updated = { ...prev, ...partial };
            dataRef.current = updated;
            return updated;
        });
    }, []);

    const replaceData = useCallback((full: T) => {
        setData(full);
        dataRef.current = full;
    }, []);

    return {
        data,
        updateField,
        updateData,
        replaceData,
        syncStatus,
        lastSavedAt,
        isLoaded,
        errorMessage,
    };
}

import { useEffect, useState, useRef } from "react";
import { useStorage } from "../services/storage/StorageContext";

export function useSyncedState<T>(key: string, defaultValue: T) {
    const { service } = useStorage();

    // Local state to manage the value immediately for UI responsiveness
    const [state, setState] = useState<T>(defaultValue);
    const [isLoaded, setIsLoaded] = useState(false);
    const isFirstLoad = useRef(true);

    // Load initial value
    useEffect(() => {
        isFirstLoad.current = true;
        let mounted = true;

        async function load() {
            try {
                const loadedValue = await service.load<T>(key, defaultValue);
                if (mounted) {
                    setState(loadedValue);
                    setIsLoaded(true);
                }
            } catch (err) {
                console.error(`Error loading key ${key}`, err);
                if (mounted) setIsLoaded(true);
            }
        }

        load();

        return () => {
            mounted = false;
        };
    }, [service, key]); // Reload if service changes (local <-> cloud switch)

    // Subscribe to external changes (Real-time updates or other tabs)
    useEffect(() => {
        const unsubscribe = service.subscribe<T>(key, (newValue) => {
            setState(newValue);
        });
        return () => {
            unsubscribe();
        };
    }, [service, key]);

    // Save changes
    // We use a ref to track if the change came from a load or a local update to act accordingly,
    // but simpler logic: simply save whenever `state` changes, IF it's not the initial mounting.
    useEffect(() => {
        if (isFirstLoad.current) {
            isFirstLoad.current = false;
            return;
        }

        // We only save if we are loaded. Logic: Don't overwrite cloud data with defaultValue before loading finishes.
        if (isLoaded) {
            service.save(key, state);
        }
    }, [service, key, state, isLoaded]);

    return [state, setState] as const;
}

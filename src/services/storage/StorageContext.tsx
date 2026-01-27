import React, { createContext, useContext, useEffect, useState } from "react";
import { StorageService } from "./StorageService";
import { LocalStorageService } from "./LocalStorageService";
import { SupabaseService } from "./SupabaseService";

type StorageMode = "local" | "cloud";

interface StorageContextType {
    mode: StorageMode;
    setMode: (mode: StorageMode) => void;
    service: StorageService;
    isConnected: boolean; // Relevant only for cloud mode
    migrateLocalToCloud: () => Promise<void>;
}

const StorageContext = createContext<StorageContextType | null>(null);

const localService = new LocalStorageService();
// We allow lazy initialization of Supabase service in case credentials are added later
const supabaseService = new SupabaseService();

export function StorageProvider({ children }: { children: React.ReactNode }) {
    // Persist the user's preference for storage mode
    const [mode, setModeState] = useState<StorageMode>(() => {
        return (localStorage.getItem("storage_mode") as StorageMode) || "local";
    });

    const [service, setService] = useState<StorageService>(
        mode === "cloud" ? supabaseService : localService
    );

    const setMode = (newMode: StorageMode) => {
        localStorage.setItem("storage_mode", newMode);
        setModeState(newMode);
    };

    const migrateLocalToCloud = async () => {
        const keysToMigrate: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith("wallbt_") || key.startsWith("tournament_"))) {
                keysToMigrate.push(key);
            }
        }

        if (keysToMigrate.length === 0) {
            alert("Nenhum dado local encontrado para migrar.");
            return;
        }

        const confirmed = window.confirm(
            `Encontrei ${keysToMigrate.length} itens locais. Deseja sobrescrever os dados da nuvem com esses dados?`
        );
        if (!confirmed) return;

        let migratedCount = 0;
        for (const key of keysToMigrate) {
            try {
                const valueRaw = localStorage.getItem(key);
                if (valueRaw) {
                    const value = JSON.parse(valueRaw);
                    await supabaseService.save(key, value);
                    migratedCount++;
                }
            } catch (e) {
                console.error(`Erro ao migrar chave ${key}`, e);
            }
        }
        alert(`Migração concluída! ${migratedCount} itens enviados para a nuvem.`);
    };

    useEffect(() => {
        if (mode === "cloud") {
            setService(supabaseService);
        } else {
            setService(localService);
        }
    }, [mode]);

    return (
        <StorageContext.Provider
            value={{
                mode,
                setMode,
                service,
                isConnected: mode === "cloud", // Simplified for now
                migrateLocalToCloud,
            }}
        >
            {children}
        </StorageContext.Provider>
    );
}

export function useStorage() {
    const context = useContext(StorageContext);
    if (!context) {
        throw new Error("useStorage must be used within a StorageProvider");
    }
    return context;
}

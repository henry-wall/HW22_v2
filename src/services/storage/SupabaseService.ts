import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { StorageService } from "./StorageService";

// These will be populated by the user later
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export class SupabaseService implements StorageService {
    private client: SupabaseClient | null = null;
    private isConfigured = false;

    constructor() {
        if (SUPABASE_URL && SUPABASE_KEY) {
            this.client = createClient(SUPABASE_URL, SUPABASE_KEY);
            this.isConfigured = true;
        } else {
            console.warn("Supabase credentials not found. Cloud features disabled.");
        }
    }

    async load<T>(key: string, defaultValue: T): Promise<T> {
        if (!this.isConfigured || !this.client) return defaultValue;

        try {
            const { data, error } = await this.client
                .from("key_value_store")
                .select("value")
                .eq("key", key)
                .single();

            if (error) {
                // If row doesn't exist, return default
                if (error.code === "PGRST116") return defaultValue;
                console.error("Supabase load error:", error);
                return defaultValue;
            }

            return data?.value ?? defaultValue;
        } catch (err) {
            console.error("Unexpected Supabase load error:", err);
            return defaultValue;
        }
    }

    async save<T>(key: string, value: T): Promise<void> {
        if (!this.isConfigured || !this.client) return;

        try {
            const { error } = await this.client
                .from("key_value_store")
                .upsert({ key, value }, { onConflict: "key" });

            if (error) {
                console.error("Supabase save error:", error);
            }
        } catch (err) {
            console.error("Unexpected Supabase save error:", err);
        }
    }

    subscribe<T>(key: string, callback: (newValue: T) => void): () => void {
        if (!this.isConfigured || !this.client) return () => { };

        const channel = this.client
            .channel(`public:key_value_store:key=eq.${key}`)
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "key_value_store",
                    filter: `key=eq.${key}`,
                },
                (payload) => {
                    if (payload.new && payload.new.value) {
                        callback(payload.new.value as T);
                    }
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "key_value_store",
                    filter: `key=eq.${key}`,
                },
                (payload) => {
                    if (payload.new && payload.new.value) {
                        callback(payload.new.value as T);
                    }
                }
            )
            .subscribe();

        return () => {
            this.client?.removeChannel(channel);
        };
    }
}

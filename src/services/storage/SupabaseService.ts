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

        const { data, error } = await this.client
            .from("key_value_store")
            .select("value")
            .eq("key", key)
            .single();

        if (error) {
            // If row doesn't exist, return default. This is NOT an error.
            if (error.code === "PGRST116") return defaultValue;

            // For other errors (network, auth, etc), THROW so the hook knows it failed
            console.error("Supabase load error:", error);
            throw new Error(error.message);
        }

        return data?.value ?? defaultValue;
    }

    async save<T>(key: string, value: T): Promise<void> {
        if (!this.isConfigured || !this.client) return;

        const { error } = await this.client
            .from("key_value_store")
            .upsert({ key, value }, { onConflict: "key" });

        if (error) {
            console.error("Supabase save error:", error);
            throw new Error(error.message);
        }
    }

    subscribe<T>(key: string, callback: (newValue: T) => void): () => void {
        if (!this.isConfigured || !this.client) return () => { };

        console.log(`[SupabaseService] Subscribing to key: ${key}`);

        const channel = this.client
            .channel(`public:key_value_store:key=eq.${key}`)
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "key_value_store",
                    // filter: `key=eq.${key}`,
                },
                (payload) => {
                    console.log(`[SupabaseService] Received UPDATE for ${key}`, payload);
                    if (payload.new && payload.new.key === key && payload.new.value) {
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
                    // filter: `key=eq.${key}`, // Removing filter to debug
                },
                (payload) => {
                    console.log(`[SupabaseService] Received INSERT for ${key}`, payload);
                    if (payload.new && payload.new.key === key && payload.new.value) {
                        callback(payload.new.value as T);
                    }
                }
            )
            .subscribe((status, err) => {
                console.log(`[SupabaseService] Subscription status for ${key}:`, status);
                if (err) {
                    console.error(`[SupabaseService] Subscription error for ${key}:`, err);
                }
            });

        return () => {
            console.log(`[SupabaseService] Unsubscribing from ${key}`);
            this.client?.removeChannel(channel);
        };
    }
}

export interface StorageService {
    /**
     * Loads data from storage.
     * @param key Unique key for the data.
     * @param defaultValue Value to return if data not found.
     */
    load<T>(key: string, defaultValue: T): Promise<T>;

    /**
     * Saves data to storage.
     * @param key Unique key for the data.
     * @param value Data to save.
     */
    save<T>(key: string, value: T): Promise<void>;

    /**
     * Subscribes to changes for a given key.
     * @param key Unique key to listen for.
     * @param callback Function called when data changes.
     * @returns Unsubscribe function.
     */
    subscribe<T>(key: string, callback: (newValue: T) => void): () => void;
}

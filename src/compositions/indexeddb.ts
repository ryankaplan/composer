// IndexedDB wrapper for composition persistence

import {
  PersistedCompositionV1,
  PersistedMetaV1,
  validatePersistedCompositionV1,
  validatePersistedMetaV1,
} from "./schema";

const DB_NAME = "composer";
const DB_VERSION = 2;
const COMPOSITIONS_STORE = "compositions";
const META_STORE = "meta";
const META_KEY = "app";

export class CompositionDB {
  private db: IDBDatabase | null = null;

  /**
   * Open the IndexedDB database and create object stores if needed.
   */
  async open(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error("Failed to open IndexedDB"));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create compositions store
        if (!db.objectStoreNames.contains(COMPOSITIONS_STORE)) {
          db.createObjectStore(COMPOSITIONS_STORE, { keyPath: "id" });
        }

        // Create meta store
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE, { keyPath: "key" });
        }
      };
    });
  }

  /**
   * List all compositions, sorted by updatedAt descending (newest first).
   */
  async listCompositions(): Promise<PersistedCompositionV1[]> {
    if (!this.db) throw new Error("Database not opened");

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(COMPOSITIONS_STORE, "readonly");
      const store = transaction.objectStore(COMPOSITIONS_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const compositions = request.result
          .map((x) => validatePersistedCompositionV1(x))
          .filter((x): x is PersistedCompositionV1 => x !== null);

        // Sort by updatedAt descending
        compositions.sort((a, b) => b.updatedAt - a.updatedAt);

        resolve(compositions);
      };

      request.onerror = () => {
        reject(new Error("Failed to list compositions"));
      };
    });
  }

  /**
   * Get a single composition by ID.
   */
  async getComposition(id: string): Promise<PersistedCompositionV1 | null> {
    if (!this.db) throw new Error("Database not opened");

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(COMPOSITIONS_STORE, "readonly");
      const store = transaction.objectStore(COMPOSITIONS_STORE);
      const request = store.get(id);

      request.onsuccess = () => {
        const validated = validatePersistedCompositionV1(request.result);
        resolve(validated);
      };

      request.onerror = () => {
        reject(new Error(`Failed to get composition ${id}`));
      };
    });
  }

  /**
   * Put (insert or update) a composition.
   */
  async putComposition(composition: PersistedCompositionV1): Promise<void> {
    if (!this.db) throw new Error("Database not opened");

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(COMPOSITIONS_STORE, "readwrite");
      const store = transaction.objectStore(COMPOSITIONS_STORE);
      const request = store.put(composition);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error("Failed to put composition"));
      };
    });
  }

  /**
   * Delete a composition by ID.
   */
  async deleteComposition(id: string): Promise<void> {
    if (!this.db) throw new Error("Database not opened");

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(COMPOSITIONS_STORE, "readwrite");
      const store = transaction.objectStore(COMPOSITIONS_STORE);
      const request = store.delete(id);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error(`Failed to delete composition ${id}`));
      };
    });
  }

  /**
   * Get application metadata.
   */
  async getMeta(): Promise<PersistedMetaV1 | null> {
    if (!this.db) throw new Error("Database not opened");

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(META_STORE, "readonly");
      const store = transaction.objectStore(META_STORE);
      const request = store.get(META_KEY);

      request.onsuccess = () => {
        if (!request.result) {
          resolve(null);
          return;
        }

        const validated = validatePersistedMetaV1(request.result);
        resolve(validated);
      };

      request.onerror = () => {
        reject(new Error("Failed to get meta"));
      };
    });
  }

  /**
   * Put (insert or update) application metadata.
   */
  async putMeta(meta: PersistedMetaV1): Promise<void> {
    if (!this.db) throw new Error("Database not opened");

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(META_STORE, "readwrite");
      const store = transaction.objectStore(META_STORE);
      const request = store.put({ key: META_KEY, ...meta });

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error("Failed to put meta"));
      };
    });
  }
}


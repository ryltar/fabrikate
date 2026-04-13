import type { StorageLike } from "../../types";

export function createMemoryStorage(seed?: Record<string, unknown>): StorageLike {
  const entries = new Map<string, string>();

  if (seed) {
    for (const [key, value] of Object.entries(seed)) {
      entries.set(key, JSON.stringify(value));
    }
  }

  return {
    get length() {
      return entries.size;
    },
    key(index) {
      return Array.from(entries.keys())[index] ?? null;
    },
    getItem(key) {
      return entries.get(key) ?? null;
    },
    setItem(key, value) {
      entries.set(key, value);
    },
    removeItem(key) {
      entries.delete(key);
    },
  };
}

export function resolveStorage(storage?: StorageLike): StorageLike {
  if (storage) {
    return storage;
  }

  if (typeof localStorage !== "undefined") {
    return localStorage;
  }

  throw new Error(
    "Stub mode requires a storage implementation or a global localStorage.",
  );
}

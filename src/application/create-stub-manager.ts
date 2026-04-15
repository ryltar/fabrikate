import type {
  StubManager,
  StubPostGeneratedFieldsInput,
  StubPostGeneratedFieldsJsonInput,
  StubScenarioPresets,
  StubStorageQueryOptions,
  StorageLike,
} from "../types";

export function createStubManager({
  getEnabled,
  setEnabled,
  getStorage,
  storagePrefix,
  getPostGeneratedFields,
  setPostGeneratedFields,
  getPostGeneratedFieldsJson,
  setPostGeneratedFieldsJson,
  scenarioPresets,
}: {
  getEnabled: () => boolean;
  setEnabled: (next: boolean) => void;
  getStorage: () => StorageLike;
  storagePrefix: string;
  getPostGeneratedFields: () => StubPostGeneratedFieldsInput | undefined;
  setPostGeneratedFields: (config?: StubPostGeneratedFieldsInput) => void;
  getPostGeneratedFieldsJson: () =>
    | StubPostGeneratedFieldsJsonInput
    | undefined;
  setPostGeneratedFieldsJson: (
    config?: StubPostGeneratedFieldsJsonInput,
  ) => void;
  scenarioPresets?: StubScenarioPresets;
}): StubManager {
  const enabledListeners = new Set<(enabled: boolean) => void>();

  return {
    get enabled() {
      return getEnabled();
    },
    setEnabled(next) {
      const previous = getEnabled();
      setEnabled(next);
      const current = getEnabled();
      if (previous === current) {
        return;
      }

      enabledListeners.forEach((listener) => listener(current));
    },
    subscribeEnabled(listener) {
      enabledListeners.add(listener);
      listener(getEnabled());
      return () => {
        enabledListeners.delete(listener);
      };
    },
    getStoragePrefix() {
      return storagePrefix;
    },
    listStorageKeys(options) {
      const storage = getStorage();
      const keys = listStorageKeys(storage);
      return withPrefixFilter(keys, storagePrefix, options);
    },
    getStorageValue<TValue = unknown>(key: string): TValue | null {
      const storage = getStorage();
      const raw = storage.getItem(key);
      if (raw === null) {
        return null;
      }

      try {
        return JSON.parse(raw) as TValue;
      } catch {
        return raw as TValue;
      }
    },
    setStorageValue(key, value) {
      const storage = getStorage();
      storage.setItem(key, JSON.stringify(value));
    },
    removeStorageKey(key) {
      const storage = getStorage();
      storage.removeItem(key);
    },
    clearStorage(options) {
      const storage = getStorage();
      const keys = withPrefixFilter(
        listStorageKeys(storage),
        storagePrefix,
        options,
      );
      for (const key of keys) {
        storage.removeItem(key);
      }
    },
    exportStorageSnapshot(options) {
      const storage = getStorage();
      const snapshot: Record<string, unknown> = {};
      const keys = withPrefixFilter(
        listStorageKeys(storage),
        storagePrefix,
        options,
      );

      for (const key of keys) {
        const raw = storage.getItem(key);
        if (raw === null) {
          continue;
        }

        try {
          snapshot[key] = JSON.parse(raw);
        } catch {
          snapshot[key] = raw;
        }
      }

      return snapshot;
    },
    importStorageSnapshot(snapshot, options) {
      const storage = getStorage();
      if (options?.clearFirst) {
        const keys = withPrefixFilter(listStorageKeys(storage), storagePrefix);
        for (const key of keys) {
          storage.removeItem(key);
        }
      }

      for (const [key, value] of Object.entries(snapshot)) {
        storage.setItem(key, JSON.stringify(value));
      }
    },
    getPostGeneratedFields() {
      return getPostGeneratedFields();
    },
    setPostGeneratedFields(config) {
      setPostGeneratedFields(config);
    },
    getPostGeneratedFieldsJson() {
      return getPostGeneratedFieldsJson();
    },
    setPostGeneratedFieldsJson(config) {
      setPostGeneratedFieldsJson(config);
    },
    getScenarioPresets() {
      return scenarioPresets ?? {};
    },
  };
}

function withPrefixFilter(
  keys: string[],
  storagePrefix: string,
  options?: StubStorageQueryOptions,
): string[] {
  if (options?.prefixOnly === false) {
    return keys;
  }

  const prefix = `${storagePrefix}:`;
  return keys.filter((key) => key.startsWith(prefix));
}

function listStorageKeys(storage: StorageLike): string[] {
  if (typeof storage.key !== "function" || typeof storage.length !== "number") {
    throw new Error(
      "Storage backend does not support key enumeration. Provide a storage with key(index) and length.",
    );
  }

  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key) {
      keys.push(key);
    }
  }

  return keys;
}

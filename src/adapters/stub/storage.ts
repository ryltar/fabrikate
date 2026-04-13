import type { StorageLike } from "../../types";

export function readStorageValue<TValue>(
  storage: StorageLike,
  key: string,
): TValue | null {
  const rawValue = storage.getItem(key);

  if (rawValue === null) {
    return null;
  }

  return JSON.parse(rawValue) as TValue;
}

export function writeStorageValue<TValue>(
  storage: StorageLike,
  key: string,
  value: TValue,
): void {
  storage.setItem(key, JSON.stringify(value));
}

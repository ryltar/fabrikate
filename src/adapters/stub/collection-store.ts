import { DEFAULT_STUB_ID_FIELDS } from "../../constants";
import type { StorageLike } from "../../types";
import { getFirstDefinedString, isPlainObject } from "../../utils/value";
import { readStorageValue, writeStorageValue } from "./storage";

type CollectionEntity = Record<string, unknown>;

export class StubCollectionStore {
  private readonly idFields: string[];

  constructor(
    private readonly storage: StorageLike,
    private readonly storageKey: string,
    idFields?: string[],
  ) {
    this.idFields = idFields?.length
      ? [...idFields]
      : [...DEFAULT_STUB_ID_FIELDS];
  }

  getCollection<TItem>(): TItem[] {
    return readStorageValue<TItem[]>(this.storage, this.storageKey) ?? [];
  }

  replaceCollection<TItem>(items: TItem[]): TItem[] {
    writeStorageValue(this.storage, this.storageKey, items);
    return items;
  }

  clearCollection<TItem>(): TItem[] {
    const previous = this.getCollection<TItem>();
    this.storage.removeItem(this.storageKey);
    return previous;
  }

  findItem<TItem>(itemId: string): TItem | null {
    const items = this.getCollection<TItem>();
    return items.find((item) => this.readEntityId(item) === itemId) ?? null;
  }

  upsertItem<TItem>(item: TItem, preferredId?: string): TItem {
    const preparedItem = this.ensureEntityId(item, preferredId);
    const resolvedId = this.readEntityId(preparedItem);

    if (!resolvedId) {
      throw new Error("Collection stub items must expose an identifier.");
    }

    const items = this.getCollection<TItem>();
    const nextItems = [...items];
    const existingIndex = nextItems.findIndex(
      (entry) => this.readEntityId(entry) === resolvedId,
    );

    if (existingIndex === -1) {
      nextItems.push(preparedItem);
    } else {
      nextItems[existingIndex] = preparedItem;
    }

    this.replaceCollection(nextItems);
    return preparedItem;
  }

  mergeItem<TItem>(itemId: string, patch: Partial<TItem>): TItem {
    const currentItem = this.findItem<TItem>(itemId);

    if (!isPlainObject(currentItem) || !isPlainObject(patch)) {
      throw new Error(
        `Stub PATCH requires an existing object item for collection entry "${itemId}".`,
      );
    }

    const nextItem = {
      ...currentItem,
      ...patch,
    } as TItem;

    return this.upsertItem(nextItem, itemId);
  }

  removeItem<TItem>(itemId: string): TItem | null {
    const items = this.getCollection<TItem>();
    const nextItems: TItem[] = [];
    let removed: TItem | null = null;

    for (const item of items) {
      if (this.readEntityId(item) === itemId) {
        removed = item;
        continue;
      }

      nextItems.push(item);
    }

    if (removed === null) {
      return null;
    }

    this.replaceCollection(nextItems);
    return removed;
  }

  private ensureEntityId<TItem>(item: TItem, preferredId?: string): TItem {
    if (!isPlainObject(item)) {
      return item;
    }

    const existingId = getFirstDefinedString(item as CollectionEntity, this.idFields);

    if (existingId) {
      return item;
    }

    const primaryIdField = this.idFields[0] ?? "id";
    const nextId = preferredId ?? createGeneratedId();

    return {
      ...item,
      [primaryIdField]: nextId,
    } as TItem;
  }

  private readEntityId<TItem>(item: TItem): string | undefined {
    if (!isPlainObject(item)) {
      return undefined;
    }

    return getFirstDefinedString(item as CollectionEntity, this.idFields);
  }
}

function createGeneratedId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `stub-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

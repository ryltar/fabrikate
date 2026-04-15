import type {
  RequestOptions,
  StorageLike,
  StubRouteDescriptor,
  StubStrategy,
} from "../../types";
import { normalizePath } from "../../http/url";

export function resolveStubRoute<TBody, TResponse>({
  url,
  method,
  options,
  storage,
  storagePrefix,
  defaultStrategy,
}: {
  url: string;
  method: string;
  options: RequestOptions<TBody, TResponse>;
  storage: StorageLike;
  storagePrefix: string;
  defaultStrategy: StubStrategy;
}): StubRouteDescriptor {
  const strategy = options.stubStrategy ?? defaultStrategy;
  const path = normalizePath(url);
  const segments = path === "/" ? [] : path.split("/").filter(Boolean);
  const itemId =
    segments.length >= 2
      ? decodeURIComponent(segments.at(-1) ?? "")
      : undefined;
  const collectionPath =
    segments.length >= 2 ? `/${segments.slice(0, -1).join("/")}` : path;
  const resourceKey = options.stubKey ?? `${storagePrefix}:resource:${url}`;
  const collectionKey = `${storagePrefix}:collection:${collectionPath}`;
  const hasExistingCollection = storage.getItem(collectionKey) !== null;
  const prefersCollection = detectCollectionPreference({
    strategy,
    method,
    itemId,
    path,
    options,
    hasExistingCollection,
  });

  return {
    strategy: prefersCollection ? "collection" : "resource",
    storageKey: prefersCollection ? collectionKey : resourceKey,
    resourceKey,
    collectionKey,
    path,
    collectionPath,
    itemId,
    isCollection: prefersCollection,
    isItem: Boolean(itemId),
  };
}

function detectCollectionPreference<TBody, TResponse>({
  strategy,
  method,
  itemId,
  path,
  options,
  hasExistingCollection,
}: {
  strategy: StubStrategy;
  method: string;
  itemId?: string;
  path: string;
  options: RequestOptions<TBody, TResponse>;
  hasExistingCollection: boolean;
}): boolean {
  if (strategy === "collection") {
    return true;
  }

  if (strategy === "resource") {
    return false;
  }

  if (options.stubKey) {
    return false;
  }

  if (itemId) {
    return true;
  }

  if (method === "POST") {
    return true;
  }

  if (hasExistingCollection) {
    return true;
  }

  if (Array.isArray(options.body)) {
    return true;
  }

  return path.split("/").filter(Boolean).length > 1;
}

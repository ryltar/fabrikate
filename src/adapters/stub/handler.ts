import type {
  RequestOptions,
  StorageLike,
  StubGeneratedFields,
  StubDataFactory,
  StubPostGeneratedFieldsConfig,
  StubContext,
  StubRouteDescriptor,
} from "../../types";
import { StubCollectionStore } from "./collection-store";
import { applyCollectionQuery } from "./query";
import { readStorageValue, writeStorageValue } from "./storage";

export function handleResourceStubRequest<TBody, TResponse>({
  storage,
  method,
  options,
  headers,
  route,
  postGeneratedFields,
}: {
  storage: StorageLike;
  method: string;
  options: RequestOptions<TBody, TResponse>;
  headers: Headers;
  route: StubRouteDescriptor;
  postGeneratedFields?: StubPostGeneratedFieldsConfig;
}): TResponse {
  const existingData = readStorageValue<TResponse>(storage, route.resourceKey);
  const context = createStubContext({
    storage,
    method,
    options,
    headers,
    route,
    existingData,
  });

  switch (method) {
    case "GET":
    case "HEAD":
    case "OPTIONS":
      return readOrCreateStubValue(context);
    case "POST":
      return createResourceValue(context, postGeneratedFields);
    case "PUT":
      return replaceResourceValue(context);
    case "PATCH":
      return patchResourceValue(context);
    case "DELETE":
      storage.removeItem(route.resourceKey);
      return existingData as TResponse;
    default:
      return replaceResourceValue(context);
  }
}

export function handleCollectionStubRequest<TBody, TResponse>({
  storage,
  method,
  options,
  headers,
  route,
  idFields,
  postGeneratedFields,
}: {
  storage: StorageLike;
  method: string;
  options: RequestOptions<TBody, TResponse>;
  headers: Headers;
  route: StubRouteDescriptor;
  idFields?: string[];
  postGeneratedFields?: StubPostGeneratedFieldsConfig;
}): TResponse {
  const store = new StubCollectionStore(storage, route.collectionKey, idFields);
  const existingData = route.isItem
    ? store.findItem<TResponse>(route.itemId ?? "")
    : (store.getCollection<TResponse>() as TResponse);
  const context = createStubContext({
    storage,
    method,
    options,
    headers,
    route,
    existingData,
  });

  switch (method) {
    case "GET":
    case "HEAD":
    case "OPTIONS":
      return route.isItem
        ? readOrCreateCollectionItem(store, context)
        : readOrCreateCollection(store, context);
    case "POST":
      return createCollectionValue(store, context, postGeneratedFields);
    case "PUT":
      return route.isItem
        ? replaceCollectionItem(store, context)
        : replaceCollection(store, context);
    case "PATCH":
      return route.isItem
        ? patchCollectionItem(store, context)
        : patchCollection(store, context);
    case "DELETE":
      return route.isItem
        ? (store.removeItem<TResponse>(route.itemId ?? "") as TResponse)
        : (store.clearCollection<TResponse>() as TResponse);
    default:
      return route.isItem
        ? replaceCollectionItem(store, context)
        : replaceCollection(store, context);
  }
}

function createStubContext<TBody, TResponse>({
  storage,
  method,
  options,
  headers,
  route,
  existingData,
}: {
  storage: StubContext<TBody, TResponse>["storage"];
  method: string;
  options: RequestOptions<TBody, TResponse>;
  headers: Headers;
  route: StubRouteDescriptor;
  existingData: TResponse | null;
}): StubContext<TBody, TResponse> {
  return {
    key: route.storageKey,
    path: options.path,
    url: route.path,
    method,
    body: options.body,
    stubData: options.stubData,
    headers,
    query: options.query,
    existingData,
    storage,
    route,
  };
}

function readOrCreateStubValue<TBody, TResponse>(
  context: StubContext<TBody, TResponse>,
): TResponse {
  if (context.existingData !== null) {
    return context.existingData;
  }

  const seededValue = resolveStubData(context.stubData);
  if (seededValue !== undefined) {
    writeStorageValue(context.storage, context.route.resourceKey, seededValue);
    return seededValue;
  }

  if (context.body !== undefined) {
    const created = coerceBodyValue<TBody, TResponse>(context.body, "GET");
    writeStorageValue(context.storage, context.route.resourceKey, created);
    return created;
  }

  throw new Error(
    `Stub GET ${context.url} requires data in storage or a request body.`,
  );
}

function createResourceValue<TBody, TResponse>(
  context: StubContext<TBody, TResponse>,
  postGeneratedFields?: StubPostGeneratedFieldsConfig,
): TResponse {
  const baseCreated = coerceBodyValue<TBody, TResponse>(context.body, "POST");

  const created = applyPostGeneratedFields(
    context,
    baseCreated,
    postGeneratedFields,
  );

  writeStorageValue(context.storage, context.route.resourceKey, created);
  return created;
}

function replaceResourceValue<TBody, TResponse>(
  context: StubContext<TBody, TResponse>,
): TResponse {
  const nextValue = coerceBodyValue<TBody, TResponse>(
    context.body,
    context.method,
  );

  writeStorageValue(context.storage, context.route.resourceKey, nextValue);
  return nextValue;
}

function patchResourceValue<TBody, TResponse>(
  context: StubContext<TBody, TResponse>,
): TResponse {
  const nextValue = mergeStubData(
    context.existingData,
    context.body,
    context.method,
  );

  writeStorageValue(context.storage, context.route.resourceKey, nextValue);
  return nextValue;
}

function readOrCreateCollection<TBody, TResponse>(
  store: StubCollectionStore,
  context: StubContext<TBody, TResponse>,
): TResponse {
  if (Array.isArray(context.existingData)) {
    return applyCollectionQuery(
      context.existingData,
      context.query,
    ) as TResponse;
  }

  const seededCollection = resolveStubData(context.stubData);
  if (Array.isArray(seededCollection)) {
    const createdCollection = store.replaceCollection(seededCollection);
    return applyCollectionQuery(createdCollection, context.query) as TResponse;
  }

  return applyCollectionQuery([], context.query) as TResponse;
}

function readOrCreateCollectionItem<TBody, TResponse>(
  store: StubCollectionStore,
  context: StubContext<TBody, TResponse>,
): TResponse {
  if (context.existingData !== null) {
    return context.existingData;
  }

  const seededItem = resolveStubData(context.stubData);
  if (seededItem !== undefined) {
    return store.upsertItem(seededItem, context.route.itemId);
  }

  throw new Error(`Stub GET ${context.url} item not found in storage.`);
}

function createCollectionValue<TBody, TResponse>(
  store: StubCollectionStore,
  context: StubContext<TBody, TResponse>,
  postGeneratedFields?: StubPostGeneratedFieldsConfig,
): TResponse {
  const baseCreated = coerceBodyValue<TBody, TResponse>(context.body, "POST");

  const created = applyPostGeneratedFields(
    context,
    baseCreated,
    postGeneratedFields,
  );

  if (context.route.isItem) {
    return store.upsertItem(created, context.route.itemId);
  }

  return store.upsertItem(created);
}

function replaceCollection<TBody, TResponse>(
  store: StubCollectionStore,
  context: StubContext<TBody, TResponse>,
): TResponse {
  const nextValue = coerceBodyValue<TBody, TResponse>(
    context.body,
    context.method,
  );

  if (!Array.isArray(nextValue)) {
    throw new Error(
      `Stub ${context.method} ${context.url} expects an array when targeting a collection.`,
    );
  }

  return store.replaceCollection(nextValue) as TResponse;
}

function replaceCollectionItem<TBody, TResponse>(
  store: StubCollectionStore,
  context: StubContext<TBody, TResponse>,
): TResponse {
  const nextValue = coerceBodyValue<TBody, TResponse>(
    context.body,
    context.method,
  );

  return store.upsertItem(nextValue, context.route.itemId);
}

function patchCollection<TBody, TResponse>(
  store: StubCollectionStore,
  context: StubContext<TBody, TResponse>,
): TResponse {
  const nextValue = coerceBodyValue<TBody, TResponse>(context.body, "PATCH");

  if (!Array.isArray(nextValue)) {
    throw new Error(
      `Stub PATCH ${context.url} expects an array when targeting a collection root.`,
    );
  }

  return store.replaceCollection(nextValue) as TResponse;
}

function patchCollectionItem<TBody, TResponse>(
  store: StubCollectionStore,
  context: StubContext<TBody, TResponse>,
): TResponse {
  return store.mergeItem(
    context.route.itemId ?? "",
    coerceBodyValue<TBody, Partial<TResponse>>(context.body, "PATCH"),
  ) as TResponse;
}

function mergeStubData<TBody, TResponse>(
  existingData: TResponse | null,
  body: TBody | undefined,
  method: string,
): TResponse {
  if (isMergeableObject(existingData) && isMergeableObject(body)) {
    return {
      ...existingData,
      ...body,
    } as TResponse;
  }

  return coerceBodyValue<TBody, TResponse>(body, method);
}

function coerceBodyValue<TBody, TResponse>(
  body: TBody | undefined,
  method: string,
): TResponse {
  if (body === undefined) {
    throw new Error(`Stub ${method} requires a request body.`);
  }

  return body as unknown as TResponse;
}

function isMergeableObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function resolveStubData<TResponse>(
  stubData: StubContext<unknown, TResponse>["stubData"],
): TResponse | undefined {
  if (typeof stubData === "function") {
    return (stubData as StubDataFactory<TResponse>)();
  }

  return stubData;
}

function applyPostGeneratedFields<TBody, TResponse>(
  context: StubContext<TBody, TResponse>,
  value: TResponse,
  postGeneratedFields?: StubPostGeneratedFieldsConfig,
): TResponse {
  if (!isMergeableObject(value) || !postGeneratedFields) {
    return value;
  }

  const resolver =
    postGeneratedFields[context.route.collectionPath] ??
    postGeneratedFields[context.path] ??
    postGeneratedFields[context.route.path];

  if (!resolver) {
    return value;
  }

  const generated =
    typeof resolver === "function"
      ? resolver(context as StubContext<unknown, unknown>)
      : resolver;

  if (!isMergeableObject(generated)) {
    return value;
  }

  return {
    ...value,
    ...(generated as StubGeneratedFields),
  } as TResponse;
}

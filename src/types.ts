export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS"
  | "TRACE";

export type QueryParamValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Date;

export type QueryParams = Record<string, QueryParamValue | QueryParamValue[]>;

export type StubStrategy = "auto" | "resource" | "collection";

export type StubDataFactory<TResponse> = () => TResponse;

export type StubDataInput<TResponse> = TResponse | StubDataFactory<TResponse>;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key?(index: number): string | null;
  readonly length?: number;
}

export interface StubScenario {
  label: string;
  description?: string;
  execute(manager: StubManager): void;
}

export interface StubScenarioPresets {
  [name: string]: StubScenario;
}

export interface ClientConfig {
  baseUrl?: string;
  headers?: HeadersInit;
  stub?: boolean;
  storage?: StorageLike;
  storagePrefix?: string;
  fetchFn?: typeof fetch;
  stubStrategy?: StubStrategy;
  stubIdFields?: string[];
  stubPostGeneratedFields?: StubPostGeneratedFieldsInput;
  stubPostGeneratedFieldsJson?: StubPostGeneratedFieldsJsonInput;
  devMode?: boolean;
  stubScenarioPresets?: StubScenarioPresets;
}

export interface StubStorageQueryOptions {
  prefixOnly?: boolean;
}

export interface StubImportOptions {
  clearFirst?: boolean;
}

export interface StubManager {
  readonly enabled: boolean;
  setEnabled(next: boolean): void;
  subscribeEnabled(listener: (enabled: boolean) => void): () => void;
  getStoragePrefix(): string;
  listStorageKeys(options?: StubStorageQueryOptions): string[];
  getStorageValue<TValue = unknown>(key: string): TValue | null;
  setStorageValue(key: string, value: unknown): void;
  removeStorageKey(key: string): void;
  clearStorage(options?: StubStorageQueryOptions): void;
  exportStorageSnapshot(
    options?: StubStorageQueryOptions,
  ): Record<string, unknown>;
  importStorageSnapshot(
    snapshot: Record<string, unknown>,
    options?: StubImportOptions,
  ): void;
  getPostGeneratedFields(): StubPostGeneratedFieldsInput | undefined;
  setPostGeneratedFields(config?: StubPostGeneratedFieldsInput): void;
  getPostGeneratedFieldsJson(): StubPostGeneratedFieldsJsonInput | undefined;
  setPostGeneratedFieldsJson(config?: StubPostGeneratedFieldsJsonInput): void;
  getScenarioPresets(): StubScenarioPresets;
}

export interface StubRouteDescriptor {
  strategy: StubStrategy;
  storageKey: string;
  resourceKey: string;
  collectionKey: string;
  path: string;
  collectionPath: string;
  itemId?: string;
  isCollection: boolean;
  isItem: boolean;
}

export interface StubContext<TBody, TResponse> {
  key: string;
  path: string;
  url: string;
  method: string;
  body: TBody | undefined;
  stubData?: StubDataInput<TResponse>;
  headers: Headers;
  query?: QueryParams;
  existingData: TResponse | null;
  storage: StorageLike;
  route: StubRouteDescriptor;
}

export type StubGeneratedFields = Record<string, unknown>;

export type StubGeneratedFieldsFactory = (
  context: StubContext<unknown, unknown>,
) => StubGeneratedFields;

export type StubPostGeneratedFieldsConfig = Record<
  string,
  StubGeneratedFields | StubGeneratedFieldsFactory
>;

export type StubPostGeneratedFieldsInput =
  | StubPostGeneratedFieldsConfig
  | (() => StubPostGeneratedFieldsConfig);

export interface StubJsonIntRule {
  type: "number.int";
  min?: number;
  max?: number;
  asString?: boolean;
}

export interface StubJsonUuidRule {
  type: "string.uuid";
}

export interface StubJsonWordRule {
  type: "string.word";
}

export interface StubJsonFirstNameRule {
  type: "person.firstName";
}

export interface StubJsonLastNameRule {
  type: "person.lastName";
}

export interface StubJsonFullNameRule {
  type: "person.fullName";
}

export interface StubJsonPickRule {
  type: "pick";
  values: unknown[];
}

export interface StubJsonDateRecentRule {
  type: "date.recent";
  days?: number;
  asISOString?: boolean;
}

export interface StubJsonDateBetweenRule {
  type: "date.between";
  from: string;
  to: string;
  asISOString?: boolean;
}

export interface StubJsonNestedObjectRule {
  [key: string]: StubJsonFieldRule;
}

export type StubJsonTypedRule =
  | StubJsonIntRule
  | StubJsonUuidRule
  | StubJsonWordRule
  | StubJsonFirstNameRule
  | StubJsonLastNameRule
  | StubJsonFullNameRule
  | StubJsonPickRule
  | StubJsonDateRecentRule
  | StubJsonDateBetweenRule;

export type StubJsonFieldRule =
  | StubJsonTypedRule
  | StubJsonNestedObjectRule
  | string
  | number
  | boolean
  | null;

export type StubPostGeneratedFieldsJsonConfig = Record<
  string,
  Record<string, StubJsonFieldRule>
>;

export type StubPostGeneratedFieldsJsonInput =
  | StubPostGeneratedFieldsJsonConfig
  | (() => StubPostGeneratedFieldsJsonConfig);

export interface RequestOptions<
  TBody = unknown,
  TResponse = unknown,
> extends Omit<RequestInit, "body" | "headers" | "method"> {
  path: string;
  method?: string;
  headers?: HeadersInit;
  query?: QueryParams;
  body?: TBody;
  stubData?: StubDataInput<TResponse>;
  stub?: boolean;
  stubKey?: string;
  stubStrategy?: StubStrategy;
  parseResponse?: (response: Response) => Promise<TResponse>;
}

type NoBodyRequestOptions<TResponse> = Omit<
  RequestOptions<never, TResponse>,
  "path" | "method" | "body"
>;

type BodyRequestOptions<TBody, TResponse> = Omit<
  RequestOptions<TBody, TResponse>,
  "path" | "method" | "body"
>;

export interface FetchClient {
  stubManager?: StubManager;
  request<TResponse = unknown, TBody = unknown>(
    options: RequestOptions<TBody, TResponse>,
  ): Promise<TResponse>;
  get<TResponse = unknown>(
    path: string,
    options?: NoBodyRequestOptions<TResponse>,
  ): Promise<TResponse>;
  post<TResponse = unknown, TBody = unknown>(
    path: string,
    body?: TBody,
    options?: BodyRequestOptions<TBody, TResponse>,
  ): Promise<TResponse>;
  put<TResponse = unknown, TBody = unknown>(
    path: string,
    body?: TBody,
    options?: BodyRequestOptions<TBody, TResponse>,
  ): Promise<TResponse>;
  patch<TResponse = unknown, TBody = unknown>(
    path: string,
    body?: TBody,
    options?: BodyRequestOptions<TBody, TResponse>,
  ): Promise<TResponse>;
  delete<TResponse = unknown>(
    path: string,
    options?: NoBodyRequestOptions<TResponse>,
  ): Promise<TResponse>;
  head<TResponse = void>(
    path: string,
    options?: NoBodyRequestOptions<TResponse>,
  ): Promise<TResponse>;
  options<TResponse = unknown>(
    path: string,
    options?: NoBodyRequestOptions<TResponse>,
  ): Promise<TResponse>;
}

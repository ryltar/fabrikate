import type {
  RequestOptions,
  StorageLike,
  StubPostGeneratedFieldsConfig,
  StubPostGeneratedFieldsJsonConfig,
  StubRouteDescriptor,
  StubStrategy,
} from "../types";

export interface FetchPort {
  execute(input: { url: string; init: RequestInit }): Promise<Response>;
}

export interface StubPort {
  execute<TBody, TResponse>(input: {
    url: string;
    method: string;
    options: RequestOptions<TBody, TResponse>;
    headers: Headers;
    defaultStrategy: StubStrategy;
    idFields?: string[];
    postGeneratedFields?: StubPostGeneratedFieldsConfig;
  }): Promise<TResponse>;
}

export interface StubRouteResolverPort {
  resolve<TBody, TResponse>(input: {
    url: string;
    method: string;
    options: RequestOptions<TBody, TResponse>;
    storage: StorageLike;
    storagePrefix: string;
    defaultStrategy: StubStrategy;
  }): StubRouteDescriptor;
}

export interface StubResourceHandlerPort {
  execute<TBody, TResponse>(input: {
    storage: StorageLike;
    method: string;
    options: RequestOptions<TBody, TResponse>;
    headers: Headers;
    route: StubRouteDescriptor;
    postGeneratedFields?: StubPostGeneratedFieldsConfig;
  }): TResponse;
}

export interface StubCollectionHandlerPort {
  execute<TBody, TResponse>(input: {
    storage: StorageLike;
    method: string;
    options: RequestOptions<TBody, TResponse>;
    headers: Headers;
    route: StubRouteDescriptor;
    idFields?: string[];
    postGeneratedFields?: StubPostGeneratedFieldsConfig;
  }): TResponse;
}

export interface StubGeneratedFieldsJsonCompilerPort {
  compile(
    config?: StubPostGeneratedFieldsJsonConfig,
  ): StubPostGeneratedFieldsConfig;
}

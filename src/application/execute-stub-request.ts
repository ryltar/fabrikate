import type {
  StubCollectionHandlerPort,
  StubResourceHandlerPort,
  StubRouteResolverPort,
} from "../ports";
import type {
  RequestOptions,
  StorageLike,
  StubPostGeneratedFieldsConfig,
  StubStrategy,
} from "../types";

export async function executeStubRequest<TBody, TResponse>({
  storage,
  storagePrefix,
  url,
  method,
  options,
  headers,
  defaultStrategy,
  idFields,
  postGeneratedFields,
  routeResolver,
  collectionHandler,
  resourceHandler,
}: {
  storage: StorageLike;
  storagePrefix: string;
  url: string;
  method: string;
  options: RequestOptions<TBody, TResponse>;
  headers: Headers;
  defaultStrategy: StubStrategy;
  idFields?: string[];
  postGeneratedFields?: StubPostGeneratedFieldsConfig;
  routeResolver: StubRouteResolverPort;
  collectionHandler: StubCollectionHandlerPort;
  resourceHandler: StubResourceHandlerPort;
}): Promise<TResponse> {
  const route = routeResolver.resolve({
    url,
    method,
    options,
    storage,
    storagePrefix,
    defaultStrategy,
  });

  return route.isCollection
    ? collectionHandler.execute({
        storage,
        method,
        options,
        headers,
        route,
        idFields,
        postGeneratedFields,
      })
    : resourceHandler.execute({
        storage,
        method,
        options,
        headers,
        route,
        postGeneratedFields,
      });
}

import { DEFAULT_STORAGE_PREFIX } from "../constants";
import { createStubManager } from "../application/create-stub-manager";
import { executeRequest } from "../application/execute-request";
import { resolvePostGeneratedFields } from "../application/resolve-post-generated-fields";
import { executeStubRequest } from "../application/execute-stub-request";
import type { FetchPort, StubPort } from "../ports";
import { resolveStorage } from "../adapters/storage";
import {
  compilePostGeneratedFieldsJson,
  handleCollectionStubRequest,
  handleResourceStubRequest,
  resolveStubRoute,
} from "../adapters/stub";
import type {
  ClientConfig,
  FetchClient,
  RequestOptions,
  StubPostGeneratedFieldsInput,
  StubPostGeneratedFieldsJsonInput,
  StubPostGeneratedFieldsConfig,
  StubStrategy,
} from "../types";

export function createFetchClient(config: ClientConfig = {}): FetchClient {
  const baseHeaders = new Headers(config.headers);
  const fetchFn = config.fetchFn ?? globalThis.fetch?.bind(globalThis);
  let runtimeStubEnabled = config.stub ?? false;
  let runtimePostGeneratedFields: StubPostGeneratedFieldsInput | undefined =
    config.stubPostGeneratedFields;
  let runtimePostGeneratedFieldsJson: StubPostGeneratedFieldsJsonInput | undefined =
    config.stubPostGeneratedFieldsJson;

  const fetchPort: FetchPort | undefined = fetchFn
    ? {
        execute({ url, init }) {
          return fetchFn(url, init);
        },
      }
    : undefined;

  const stubPort: StubPort = {
    async execute<TBody, TResponse>(input: {
      url: string;
      method: string;
      options: RequestOptions<TBody, TResponse>;
      headers: Headers;
      defaultStrategy: StubStrategy;
      idFields?: string[];
      postGeneratedFields?: StubPostGeneratedFieldsConfig;
    }): Promise<TResponse> {
      const {
        url,
        method,
        options,
        headers,
        defaultStrategy,
        idFields,
        postGeneratedFields,
      } = input;
      const storage = resolveStorage(config.storage);

      return executeStubRequest<TBody, TResponse>({
        storage,
        storagePrefix: config.storagePrefix ?? DEFAULT_STORAGE_PREFIX,
        url,
        method,
        options,
        headers,
        defaultStrategy,
        idFields,
        postGeneratedFields,
        routeResolver: {
          resolve: resolveStubRoute,
        },
        collectionHandler: {
          execute: handleCollectionStubRequest,
        },
        resourceHandler: {
          execute: handleResourceStubRequest,
        },
      });
    },
  };

  async function request<TResponse = unknown, TBody = unknown>(
    options: RequestOptions<TBody, TResponse>,
  ): Promise<TResponse> {
    const shouldStub = options.stub ?? runtimeStubEnabled;
    const postGeneratedFields =
      typeof runtimePostGeneratedFields === "function"
        ? runtimePostGeneratedFields()
        : runtimePostGeneratedFields;
    const postGeneratedFieldsJson =
      typeof runtimePostGeneratedFieldsJson === "function"
        ? runtimePostGeneratedFieldsJson()
        : runtimePostGeneratedFieldsJson;
    const resolvedPostGeneratedFields = resolvePostGeneratedFields({
      inlineConfig: postGeneratedFields,
      jsonConfig: postGeneratedFieldsJson,
      jsonCompiler: {
        compile: compilePostGeneratedFieldsJson,
      },
    });

    return executeRequest<TResponse, TBody>({
      options,
      baseUrl: config.baseUrl,
      baseHeaders,
      shouldStub,
      defaultStubStrategy: config.stubStrategy ?? "auto",
      stubIdFields: config.stubIdFields,
      postGeneratedFields: resolvedPostGeneratedFields,
      fetchPort,
      stubPort,
    });
  }

  const stubManager = config.devMode
    ? createStubManager({
        getEnabled: () => runtimeStubEnabled,
        setEnabled: (next) => {
          runtimeStubEnabled = next;
        },
        getStorage: () => resolveStorage(config.storage),
        storagePrefix: config.storagePrefix ?? DEFAULT_STORAGE_PREFIX,
        getPostGeneratedFields: () => runtimePostGeneratedFields,
        setPostGeneratedFields: (nextConfig) => {
          runtimePostGeneratedFields = nextConfig;
        },
        getPostGeneratedFieldsJson: () => runtimePostGeneratedFieldsJson,
        setPostGeneratedFieldsJson: (nextConfig) => {
          runtimePostGeneratedFieldsJson = nextConfig;
        },
        scenarioPresets: config.stubScenarioPresets,
      })
    : undefined;

  return {
    stubManager,
    request,
    get(path, options) {
      return request({ ...options, method: "GET", path });
    },
    post(path, body, options) {
      return request({ ...options, method: "POST", path, body });
    },
    put(path, body, options) {
      return request({ ...options, method: "PUT", path, body });
    },
    patch(path, body, options) {
      return request({ ...options, method: "PATCH", path, body });
    },
    delete(path, options) {
      return request({ ...options, method: "DELETE", path });
    },
    head(path, options) {
      return request({ ...options, method: "HEAD", path });
    },
    options(path, options) {
      return request({ ...options, method: "OPTIONS", path });
    },
  };
}

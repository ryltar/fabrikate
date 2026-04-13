import { HttpError } from "../errors/http-error";
import { mergeHeaders, serializeBody } from "../http/request";
import { parseResponse, safeReadResponse } from "../http/response";
import { buildRequestUrl } from "../http/url";
import type { RequestOptions } from "../types";
import type { FetchPort, StubPort } from "../ports";

export async function executeRequest<TResponse = unknown, TBody = unknown>({
  options,
  baseUrl,
  baseHeaders,
  shouldStub,
  defaultStubStrategy,
  stubIdFields,
  postGeneratedFields,
  fetchPort,
  stubPort,
}: {
  options: RequestOptions<TBody, TResponse>;
  baseUrl?: string;
  baseHeaders: Headers;
  shouldStub: boolean;
  defaultStubStrategy: "auto" | "resource" | "collection";
  stubIdFields?: string[];
  postGeneratedFields?: Parameters<StubPort["execute"]>[0]["postGeneratedFields"];
  fetchPort?: FetchPort;
  stubPort?: StubPort;
}): Promise<TResponse> {
  const method = (options.method ?? "GET").toUpperCase();
  const url = buildRequestUrl(baseUrl, options.path, options.query);
  const headers = mergeHeaders(baseHeaders, options.headers);

  if (shouldStub) {
    if (!stubPort) {
      throw new Error("No stub port configured while stub mode is enabled.");
    }

    return stubPort.execute<TBody, TResponse>({
      url,
      method,
      options,
      headers,
      defaultStrategy: defaultStubStrategy,
      idFields: stubIdFields,
      postGeneratedFields,
    });
  }

  if (!fetchPort) {
    throw new Error(
      "No fetch implementation available. Provide fetchFn in the client config.",
    );
  }

  const body = serializeBody(options.body, headers);
  const response = await fetchPort.execute({
    url,
    init: {
      ...options,
      method,
      headers,
      body,
    },
  });

  if (!response.ok) {
    throw new HttpError({
      status: response.status,
      statusText: response.statusText,
      method,
      url,
      responseBody: await safeReadResponse(response),
    });
  }

  return parseResponse<TResponse>(response, method, options.parseResponse);
}

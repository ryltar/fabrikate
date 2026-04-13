import { JSON_CONTENT_TYPE } from "../constants";

export function mergeHeaders(
  baseHeaders: Headers,
  requestHeaders?: HeadersInit,
): Headers {
  const merged = new Headers(baseHeaders);

  if (requestHeaders) {
    const extraHeaders = new Headers(requestHeaders);
    extraHeaders.forEach((value, key) => {
      merged.set(key, value);
    });
  }

  return merged;
}

export function serializeBody(
  body: unknown,
  headers: Headers,
): BodyInit | undefined {
  if (body === undefined || body === null) {
    return undefined;
  }

  if (
    typeof body === "string" ||
    body instanceof Blob ||
    body instanceof FormData ||
    body instanceof URLSearchParams ||
    body instanceof ArrayBuffer ||
    ArrayBuffer.isView(body)
  ) {
    return body as BodyInit;
  }

  if (!headers.has("content-type")) {
    headers.set("content-type", JSON_CONTENT_TYPE);
  }

  return JSON.stringify(body);
}

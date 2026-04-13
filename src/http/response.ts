import { JSON_CONTENT_TYPE } from "../constants";

export async function parseResponse<TResponse>(
  response: Response,
  method: string,
  parseResponseOverride?: (response: Response) => Promise<TResponse>,
): Promise<TResponse> {
  if (parseResponseOverride) {
    return parseResponseOverride(response);
  }

  if (method === "HEAD" || response.status === 204 || response.status === 205) {
    return undefined as TResponse;
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes(JSON_CONTENT_TYPE)) {
    return (await response.json()) as TResponse;
  }

  return (await response.text()) as TResponse;
}

export async function safeReadResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes(JSON_CONTENT_TYPE)) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  try {
    return await response.text();
  } catch {
    return null;
  }
}

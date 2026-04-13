export class HttpError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly method: string;
  readonly url: string;
  readonly responseBody: unknown;

  constructor({
    status,
    statusText,
    method,
    url,
    responseBody,
  }: {
    status: number;
    statusText: string;
    method: string;
    url: string;
    responseBody: unknown;
  }) {
    super(`${method} ${url} failed with ${status} ${statusText}`);
    this.name = "HttpError";
    this.status = status;
    this.statusText = statusText;
    this.method = method;
    this.url = url;
    this.responseBody = responseBody;
  }
}

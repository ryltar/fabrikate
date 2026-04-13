import type { QueryParamValue, QueryParams } from "../types";

export function buildRequestUrl(
  baseUrl: string | undefined,
  path: string,
  query?: QueryParams,
): string {
  const url = baseUrl ? new URL(path, baseUrl).toString() : path;

  if (!query || Object.keys(query).length === 0) {
    return url;
  }

  const [baseWithQuery = "", hash = ""] = url.split("#", 2);
  const [pathname, existingQuery = ""] = baseWithQuery.split("?", 2);
  const searchParams = new URLSearchParams(existingQuery);

  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        appendQueryValue(searchParams, key, item);
      }
      continue;
    }

    appendQueryValue(searchParams, key, value);
  }

  const queryString = searchParams.toString();
  const hashSuffix = hash ? `#${hash}` : "";

  return queryString
    ? `${pathname}?${queryString}${hashSuffix}`
    : `${pathname}${hashSuffix}`;
}

export function normalizePath(urlOrPath: string): string {
  const pathname = canUseNativeUrl(urlOrPath)
    ? new URL(urlOrPath).pathname
    : new URL(urlOrPath, "https://fabricate.local").pathname;

  if (!pathname || pathname === "/") {
    return "/";
  }

  return pathname.replace(/\/+$/, "") || "/";
}

function appendQueryValue(
  searchParams: URLSearchParams,
  key: string,
  value: QueryParamValue,
): void {
  if (value === undefined || value === null) {
    return;
  }

  searchParams.append(
    key,
    value instanceof Date ? value.toISOString() : String(value),
  );
}

function canUseNativeUrl(value: string): boolean {
  return /^https?:\/\//.test(value);
}

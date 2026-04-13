import type { QueryParamValue, QueryParams } from "../../types";
import { getValueAtPath } from "../../utils/object";

const RESERVED_QUERY_KEYS = new Set([
  "sort",
  "sortBy",
  "sortOrder",
  "orderBy",
  "order",
]);

export function applyCollectionQuery<TItem>(
  items: TItem[],
  query?: QueryParams,
): TItem[] {
  if (!query || items.length === 0) {
    return items;
  }

  const filtered = items.filter((item) => matchesFilters(item, query));
  const sortDescriptor = resolveSortDescriptor(query);

  if (!sortDescriptor) {
    return filtered;
  }

  return [...filtered].sort((left, right) =>
    compareValues(
      getValueAtPath(left, sortDescriptor.field),
      getValueAtPath(right, sortDescriptor.field),
      sortDescriptor.direction,
    ),
  );
}

function matchesFilters<TItem>(item: TItem, query: QueryParams): boolean {
  for (const [key, rawValue] of Object.entries(query)) {
    if (RESERVED_QUERY_KEYS.has(key)) {
      continue;
    }

    const itemValue = getValueAtPath(item, key);

    if (!matchesQueryValue(itemValue, rawValue)) {
      return false;
    }
  }

  return true;
}

function matchesQueryValue(
  itemValue: unknown,
  queryValue: QueryParamValue | QueryParamValue[],
): boolean {
  if (Array.isArray(queryValue)) {
    return queryValue.some((candidate) => matchesScalarValue(itemValue, candidate));
  }

  return matchesScalarValue(itemValue, queryValue);
}

function matchesScalarValue(
  itemValue: unknown,
  queryValue: QueryParamValue,
): boolean {
  if (queryValue === undefined || queryValue === null) {
    return itemValue === queryValue;
  }

  if (typeof itemValue === "boolean") {
    return itemValue === normalizeBoolean(queryValue);
  }

  if (typeof itemValue === "number") {
    return itemValue === normalizeNumber(queryValue);
  }

  if (itemValue instanceof Date) {
    return itemValue.toISOString() === normalizeComparableValue(queryValue);
  }

  return normalizeComparableValue(itemValue) === normalizeComparableValue(queryValue);
}

function normalizeComparableValue(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

function normalizeBoolean(value: QueryParamValue): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  return String(value).toLowerCase() === "true";
}

function normalizeNumber(value: QueryParamValue): number {
  if (typeof value === "number") {
    return value;
  }

  return Number(value);
}

function resolveSortDescriptor(query: QueryParams):
  | { field: string; direction: "asc" | "desc" }
  | undefined {
  const sort = query.sort;

  if (typeof sort === "string" && sort.length > 0) {
    return sort.startsWith("-")
      ? { field: sort.slice(1), direction: "desc" }
      : { field: sort, direction: "asc" };
  }

  const sortBy = firstString(query.sortBy) ?? firstString(query.orderBy);

  if (!sortBy) {
    return undefined;
  }

  const sortOrder = firstString(query.sortOrder) ?? firstString(query.order);

  return {
    field: sortBy,
    direction: sortOrder?.toLowerCase() === "desc" ? "desc" : "asc",
  };
}

function firstString(
  value: QueryParamValue | QueryParamValue[] | undefined,
): string | undefined {
  if (Array.isArray(value)) {
    const firstValue = value[0];
    return firstValue === undefined || firstValue === null
      ? undefined
      : String(firstValue);
  }

  return value === undefined || value === null ? undefined : String(value);
}

function compareValues(
  left: unknown,
  right: unknown,
  direction: "asc" | "desc",
): number {
  const leftComparable = toComparable(left);
  const rightComparable = toComparable(right);
  const result =
    leftComparable < rightComparable ? -1 : leftComparable > rightComparable ? 1 : 0;

  return direction === "desc" ? result * -1 : result;
}

function toComparable(value: unknown): string | number {
  if (typeof value === "number") {
    return value;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  return String(value ?? "");
}

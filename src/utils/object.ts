export function getValueAtPath(
  value: unknown,
  path: string,
): unknown {
  if (!path) {
    return value;
  }

  return path.split(".").reduce<unknown>((currentValue, segment) => {
    if (!isRecord(currentValue)) {
      return undefined;
    }

    return currentValue[segment];
  }, value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

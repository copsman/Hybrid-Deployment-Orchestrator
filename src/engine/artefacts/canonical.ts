/**
 * Canonical JSON: deterministic serialisation used for signing and hashing.
 * Object keys sorted lexicographically, arrays in order, no whitespace,
 * undefined / functions / symbols rejected, non-finite numbers rejected.
 */
export function canonicalize(value: unknown): string {
  return serialise(value, "$");
}

function serialise(value: unknown, path: string): string {
  if (value === null) return "null";
  switch (typeof value) {
    case "string":
      return JSON.stringify(value);
    case "boolean":
      return value ? "true" : "false";
    case "number":
      if (!Number.isFinite(value)) throw new Error(`canonicalize: non-finite number at ${path}`);
      return Object.is(value, -0) ? "0" : JSON.stringify(value);
    case "bigint":
      return JSON.stringify(value.toString());
    case "undefined":
    case "function":
    case "symbol":
      throw new Error(`canonicalize: unsupported ${typeof value} at ${path}`);
    case "object": {
      if (Array.isArray(value)) {
        return "[" + value.map((v, i) => serialise(v === undefined ? null : v, `${path}[${i}]`)).join(",") + "]";
      }
      if (value instanceof Uint8Array) {
        return JSON.stringify(Array.from(value));
      }
      if (value instanceof Date) {
        return JSON.stringify(value.toISOString());
      }
      const obj = value as Record<string, unknown>;
      const keys = Object.keys(obj)
        .filter((k) => obj[k] !== undefined)
        .sort();
      return (
        "{" + keys.map((k) => JSON.stringify(k) + ":" + serialise(obj[k], `${path}.${k}`)).join(",") + "}"
      );
    }
    default:
      throw new Error(`canonicalize: unsupported value at ${path}`);
  }
}

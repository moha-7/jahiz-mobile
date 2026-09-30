export function normalizeDbScalars<T>(value: T): T {
  if (value == null) return value;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map((item) => normalizeDbScalars(item)) as T;
  if (typeof value === "object") {
    const anyValue = value as any;
    if (anyValue.constructor?.name === "Decimal" && typeof anyValue.toString === "function") {
      const number = Number(anyValue.toString());
      if (!Number.isFinite(number)) throw new Error(`Unsafe decimal value from database: ${anyValue.toString()}`);
      if (Math.abs(number) > Number.MAX_SAFE_INTEGER) throw new Error(`Decimal exceeds JavaScript safe integer boundary: ${anyValue.toString()}`);
      return number as T;
    }
    return Object.fromEntries(Object.entries(anyValue).map(([key, child]) => [key, normalizeDbScalars(child)])) as T;
  }
  return value;
}

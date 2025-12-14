/**
 * Recursively convert BigInt and Date values to strings for JSON serialization
 * JSON.stringify cannot handle BigInt values, and Date objects need to be converted to ISO strings
 */
export function serializeBigInt<T>(data: T): any {
  if (data === null || data === undefined) {
    return data;
  }

  // Handle Date objects - convert to ISO string
  if (data instanceof Date) {
    return data.toISOString();
  }

  // Handle BigInt values
  if (typeof data === "bigint") {
    return data.toString();
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map((item) => serializeBigInt(item));
  }

  // Handle objects
  if (typeof data === "object") {
    const serialized: any = {};
    for (const [key, value] of Object.entries(data)) {
      serialized[key] = serializeBigInt(value);
    }
    return serialized;
  }

  // Return primitive values as-is
  return data;
}

import { Prisma } from "@prisma/client";

/**
 * Type guard to check if a value is a JsonObject
 */
export function isJsonObject(value: Prisma.JsonValue): value is Prisma.JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Type guard to check if a value is a JsonArray
 */
export function isJsonArray(value: Prisma.JsonValue): value is Prisma.JsonArray {
  return Array.isArray(value);
}

/**
 * Type guard to check if a JsonObject has a specific property
 */
export function hasProperty<K extends string>(
  obj: Prisma.JsonObject,
  key: K
): obj is Prisma.JsonObject & Record<K, Prisma.JsonValue> {
  return key in obj;
}

/**
 * Type guard to check if a JsonObject has a property that is an array
 */
export function hasArrayProperty<K extends string>(
  obj: Prisma.JsonObject,
  key: K
): obj is Prisma.JsonObject & Record<K, Prisma.JsonArray> {
  return hasProperty(obj, key) && isJsonArray(obj[key]);
}

/**
 * Type guard to check if a JsonObject has a property that is a string array
 */
export function hasStringArrayProperty<K extends string>(
  obj: Prisma.JsonObject,
  key: K
): obj is Prisma.JsonObject & Record<K, string[]> {
  return hasArrayProperty(obj, key) && obj[key].every((item) => typeof item === "string");
}

/**
 * Type guard to check if a JsonObject has a property that is a number array
 */
export function hasNumberArrayProperty<K extends string>(
  obj: Prisma.JsonObject,
  key: K
): obj is Prisma.JsonObject & Record<K, number[]> {
  return hasArrayProperty(obj, key) && obj[key].every((item) => typeof item === "number");
}

/**
 * Safely get a property from a JsonObject
 */
export function getJsonProperty<T extends Prisma.JsonValue = Prisma.JsonValue>(
  obj: Prisma.JsonObject,
  key: string
): T | undefined {
  return obj[key] as T | undefined;
}

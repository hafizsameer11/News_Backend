import env from "@/config/env";

/**
 * Normalize a URL - remove duplicate domain prefixes
 * @param url - URL that might have duplicate prefixes
 * @returns Normalized URL
 */
export function normalizeUrl(url: string): string {
  // Check for any duplicate https:// pattern (generic)
  // Pattern: https://domain.com/https://domain.com/path
  const duplicatePattern = /^(https?:\/\/[^/]+)\/(https?:\/\/[^/]+)(\/.*)$/;
  const match = url.match(duplicatePattern);
  if (match && match[1] === match[2]) {
    // Both domains are the same, remove the duplicate
    return `${match[1]}${match[3]}`;
  }
  
  return url;
}

/**
 * Convert a relative URL to an absolute URL using the backend base URL
 * @param relativeUrl - Relative URL (e.g., "/uploads/image.jpg")
 * @returns Absolute URL using BACKEND_URL from environment
 */
export function getAbsoluteUrl(relativeUrl: string | null | undefined): string | null {
  if (!relativeUrl) {
    return null;
  }

  // Normalize URL first to remove any duplicate prefixes
  let normalizedInput = normalizeUrl(relativeUrl);

  // If already an absolute URL, normalize protocol and return
  if (normalizedInput.startsWith("http://") || normalizedInput.startsWith("https://")) {
    // Ensure HTTPS in production environment
    if (process.env.NODE_ENV === "production" && normalizedInput.startsWith("http://")) {
      normalizedInput = normalizedInput.replace("http://", "https://");
    }
    return normalizedInput;
  }

  // Ensure relative URL starts with /
  const normalizedUrl = normalizedInput.startsWith("/") ? normalizedInput : `/${normalizedInput}`;

  // Get backend URL and remove trailing slash if present
  let backendUrl = env.BACKEND_URL.replace(/\/$/, "");
  
  // Ensure we have a valid backend URL
  if (!backendUrl) {
    // Fallback to localhost if BACKEND_URL is not set
    backendUrl = "http://localhost:3001";
  }
  
  // Ensure HTTPS in production environment
  if (process.env.NODE_ENV === "production" && backendUrl.startsWith("http://")) {
    backendUrl = backendUrl.replace("http://", "https://");
  }

  return `${backendUrl}${normalizedUrl}`;
}

/**
 * Convert relative URLs in an object to absolute URLs
 * Useful for converting media URLs in responses
 */
export function convertUrlsToAbsolute<T extends Record<string, any>>(obj: T): T {
  if (!obj || typeof obj !== "object") {
    return obj;
  }

  const converted = { ...obj };

  // Convert common URL fields
  const urlFields = ["url", "mainImage", "imageUrl", "avatar", "thumbnail", "image"];

  for (const field of urlFields) {
    if (converted[field] && typeof converted[field] === "string") {
      const absoluteUrl = getAbsoluteUrl(converted[field] as string);
      if (absoluteUrl !== null) {
        (converted as Record<string, unknown>)[field] = absoluteUrl;
      }
    }
  }

  // Recursively convert nested objects
  for (const key in converted) {
    if (converted[key] && typeof converted[key] === "object" && !Array.isArray(converted[key])) {
      converted[key] = convertUrlsToAbsolute(converted[key]);
    } else if (Array.isArray(converted[key])) {
      converted[key] = converted[key].map((item: any) =>
        typeof item === "object" ? convertUrlsToAbsolute(item) : item
      );
    }
  }

  return converted;
}


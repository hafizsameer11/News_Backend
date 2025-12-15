import env from "@/config/env";

/**
 * Convert a relative URL to an absolute URL using the backend base URL
 * @param relativeUrl - Relative URL (e.g., "/uploads/image.jpg")
 * @returns Absolute URL (e.g., "https://news-backend.hmstech.org/uploads/image.jpg")
 */
export function getAbsoluteUrl(relativeUrl: string | null | undefined): string | null {
  if (!relativeUrl) {
    return null;
  }

  // If already an absolute URL, return as is
  if (relativeUrl.startsWith("http://") || relativeUrl.startsWith("https://")) {
    return relativeUrl;
  }

  // Ensure relative URL starts with /
  const normalizedUrl = relativeUrl.startsWith("/") ? relativeUrl : `/${relativeUrl}`;

  // Get backend URL and remove trailing slash if present
  let backendUrl = env.BACKEND_URL.replace(/\/$/, "");
  
  // ALWAYS use production URL in production environment, or if BACKEND_URL is localhost
  // This ensures all URLs are stored with the production domain
  if (
    process.env.NODE_ENV === "production" ||
    !backendUrl ||
    backendUrl.includes("localhost") ||
    backendUrl.includes("127.0.0.1") ||
    backendUrl.startsWith("http://localhost") ||
    backendUrl.startsWith("http://127.0.0.1")
  ) {
    backendUrl = "https://news-backend.hmstech.org";
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


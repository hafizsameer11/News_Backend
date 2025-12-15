import env from "@/config/env";

/**
 * Normalize a URL - remove duplicate domain prefixes
 * @param url - URL that might have duplicate prefixes
 * @returns Normalized URL
 */
function normalizeUrl(url: string): string {
  // Check if URL has duplicate domain (e.g., "https://domain.com/https://domain.com/path")
  const productionDomain = "https://news-backend.hmstech.org";
  
  // Check for duplicate production domain
  if (url.includes(`${productionDomain}/${productionDomain}`)) {
    // Remove the duplicate prefix
    return url.replace(`${productionDomain}/`, "");
  }
  
  // Check for any duplicate https:// pattern (more generic)
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
 * @returns Absolute URL (e.g., "https://news-backend.hmstech.org/uploads/image.jpg")
 */
export function getAbsoluteUrl(relativeUrl: string | null | undefined): string | null {
  if (!relativeUrl) {
    return null;
  }

  // Normalize URL first to remove any duplicate prefixes
  let normalizedInput = normalizeUrl(relativeUrl);

  // If already an absolute URL, normalize protocol and return
  if (normalizedInput.startsWith("http://") || normalizedInput.startsWith("https://")) {
    // Ensure production domain uses HTTPS
    if (normalizedInput.includes("news-backend.hmstech.org") && normalizedInput.startsWith("http://")) {
      normalizedInput = normalizedInput.replace("http://", "https://");
    }
    return normalizedInput;
  }

  // Ensure relative URL starts with /
  const normalizedUrl = normalizedInput.startsWith("/") ? normalizedInput : `/${normalizedInput}`;

  // Get backend URL and remove trailing slash if present
  let backendUrl = env.BACKEND_URL.replace(/\/$/, "");
  
  // ALWAYS use production URL in production environment, or if BACKEND_URL is localhost
  // This ensures all URLs are stored with the production domain
  // Also ensure we use HTTPS in production
  if (
    process.env.NODE_ENV === "production" ||
    !backendUrl ||
    backendUrl.includes("localhost") ||
    backendUrl.includes("127.0.0.1") ||
    backendUrl.startsWith("http://localhost") ||
    backendUrl.startsWith("http://127.0.0.1") ||
    (backendUrl.includes("news-backend.hmstech.org") && backendUrl.startsWith("http://"))
  ) {
    backendUrl = "https://news-backend.hmstech.org";
  }
  
  // Normalize http:// to https:// for production domain
  if (backendUrl.includes("news-backend.hmstech.org") && backendUrl.startsWith("http://")) {
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


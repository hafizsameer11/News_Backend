import { Request, Response, NextFunction } from "express";
import { AuthenticatedRequest } from "@/types/global.types";
import { ROLE } from "@/types/enums";
import prisma from "@/config/prisma";
import { logger } from "@/utils/logger";

/**
 * Sensitive fields that should be filtered from audit logs
 */
const SENSITIVE_FIELDS = [
  "password",
  "token",
  "accessToken",
  "refreshToken",
  "apiKey",
  "secret",
  "secretKey",
  "privateKey",
  "creditCard",
  "cardNumber",
  "cvv",
  "cvc",
];

/**
 * Action patterns mapping HTTP methods and routes to action types
 */
const ACTION_PATTERNS: Record<string, string> = {
  "POST:/api/news": "CREATE_NEWS",
  "PATCH:/api/news": "UPDATE_NEWS",
  "DELETE:/api/news": "DELETE_NEWS",
  "POST:/api/categories": "CREATE_CATEGORY",
  "PATCH:/api/categories": "UPDATE_CATEGORY",
  "DELETE:/api/categories": "DELETE_CATEGORY",
  "POST:/api/ads": "CREATE_AD",
  "PATCH:/api/ads": "UPDATE_AD",
  "DELETE:/api/ads": "DELETE_AD",
  "POST:/api/ads/:id/approve": "APPROVE_AD",
  "POST:/api/ads/:id/reject": "REJECT_AD",
  "POST:/api/users": "CREATE_USER",
  "PATCH:/api/users": "UPDATE_USER",
  "DELETE:/api/users": "DELETE_USER",
  "POST:/api/auth/register": "REGISTER_USER",
  "POST:/api/auth/login": "LOGIN",
  "PATCH:/api/reports/:id/resolve": "RESOLVE_REPORT",
};

/**
 * Get action type from request
 */
function getActionType(method: string, path: string): string {
  // Try exact match first
  const exactKey = `${method}:${path}`;
  if (ACTION_PATTERNS[exactKey]) {
    return ACTION_PATTERNS[exactKey];
  }

  // Try pattern matching (e.g., /api/ads/:id/approve)
  for (const [pattern, action] of Object.entries(ACTION_PATTERNS)) {
    const [patternMethod, patternPath] = pattern.split(":");
    if (patternMethod === method) {
      // Simple pattern matching - replace :id with actual ID
      const patternRegex = new RegExp("^" + patternPath.replace(/:[^/]+/g, "[^/]+") + "$");
      if (patternRegex.test(path)) {
        return action;
      }
    }
  }

  // Default action based on method
  return `${method}_${path.split("/").pop()?.toUpperCase() || "UNKNOWN"}`;
}

/**
 * Sanitize object by removing sensitive fields
 */
function sanitizeData(data: any): any {
  if (!data || typeof data !== "object") {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeData(item));
  }

  const sanitized: any = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_FIELDS.some((field) => lowerKey.includes(field))) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeData(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Get client IP address from request
 */
function getClientIp(req: Request): string | undefined {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
    (req.headers["x-real-ip"] as string) ||
    req.socket.remoteAddress ||
    undefined
  );
}

/**
 * Audit Log Middleware
 * Automatically logs authenticated admin/editor actions
 */
export const auditLogMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  // Only log authenticated requests from Admin, Editor, or Super Admin
  if (!req.user) {
    return next();
  }

  const userRole = req.user.role;
  if (userRole !== ROLE.ADMIN && userRole !== ROLE.SUPER_ADMIN && userRole !== ROLE.EDITOR) {
    return next();
  }

  // Skip logging for GET requests (read-only operations)
  if (req.method === "GET") {
    return next();
  }

  // Skip health check and static files
  if (
    req.path === "/health" ||
    req.path.startsWith("/uploads") ||
    req.path.startsWith("/api-docs")
  ) {
    return next();
  }

  // Capture request data
  const startTime = Date.now();
  const method = req.method;
  const endpoint = req.path;
  const ipAddress = getClientIp(req);
  const userAgent = req.headers["user-agent"] || undefined;
  const userId = req.user.id;

  // Sanitize request body
  let sanitizedBody: any = null;
  if (req.body && Object.keys(req.body).length > 0) {
    sanitizedBody = sanitizeData(req.body);
  }

  // Get action type
  const action = getActionType(method, endpoint);

  // Create details object
  const details: any = {
    endpoint,
    method,
    body: sanitizedBody,
    query: req.query,
  };

  // Override response.end to capture response status
  const originalEnd = res.end.bind(res);
  res.end = function (chunk?: any, encoding?: any, cb?: () => void) {
    // Capture response status
    const responseStatus = res.statusCode;
    const responseTime = Date.now() - startTime;

    // Add response info to details
    details.responseStatus = responseStatus;
    details.responseTime = responseTime;

    // Log asynchronously (don't block response)
    setImmediate(async () => {
      try {
        await prisma.auditLog.create({
          data: {
            action,
            details: JSON.stringify(details),
            ipAddress,
            userAgent,
            method,
            endpoint,
            responseStatus,
            userId,
          },
        });
      } catch (error) {
        // Log error but don't break the request flow
        logger.error("Failed to create audit log:", error);
      }
    });

    // Call original end and return the result
    return originalEnd(chunk, encoding, cb);
  };

  next();
};

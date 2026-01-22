import { Request, Response, NextFunction } from "express";
import { errorResponse } from "@/utils/response";
import { logger } from "@/utils/logger";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";

/**
 * Global Error Handler Middleware
 * Handles all errors thrown in the application
 */
export const errorHandler = (err: Error, req: Request, res: Response, _next: NextFunction) => {
  logger.error("Error:", err);

  // Set most permissive Referrer-Policy
  res.setHeader("Referrer-Policy", "unsafe-url");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");

  // Ensure CORS headers are set even on error responses
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With, Accept, Origin, X-CSRF-Token, Cache-Control, Pragma"
  );
  res.setHeader("Access-Control-Expose-Headers", "Content-Range, X-Content-Range, Content-Length");

  // Zod validation errors
  if (err instanceof ZodError) {
    return errorResponse(res, "Validation failed", err.errors, 422);
  }

  // Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return errorResponse(res, "Duplicate entry", { field: err.meta?.target }, 409);
    }
    if (err.code === "P2025") {
      return errorResponse(res, "Record not found", null, 404);
    }
    // Check if it's a schema/column error
    if (err.message?.includes("does not exist")) {
      return errorResponse(res, "Database schema error. Please contact the administrator.", null, 500);
    }
    // Check for data truncation errors (e.g., enum values not matching)
    if (err.message?.includes("Data truncated") || err.message?.includes("code: 1265")) {
      return errorResponse(res, "Invalid data value. Please contact the administrator.", null, 500);
    }
    return errorResponse(res, "Database error", err.message, 500);
  }

  // Check for Prisma schema errors in regular Error messages
  if (err.message?.includes("does not exist") && err.message?.includes("column")) {
    return errorResponse(res, "Database configuration error. Please contact the administrator.", null, 500);
  }
  
  // Check for MySQL data truncation errors (including ConnectorError)
  if (err.message?.includes("Data truncated") || err.message?.includes("code: 1265") || err.message?.includes("ConnectorError")) {
    if (err.message?.includes("role")) {
      return errorResponse(res, "Invalid role value. The role enum may not include the required value. Please contact the administrator.", null, 500);
    }
    return errorResponse(res, "Invalid data value. Please contact the administrator.", null, 500);
  }
  
  // Check for MySQL data truncation errors
  if (err.message?.includes("Data truncated") || err.message?.includes("code: 1265") || err.message?.includes("ConnectorError")) {
    if (err.message?.includes("role")) {
      return errorResponse(res, "Invalid role value. Please contact the administrator.", null, 500);
    }
    return errorResponse(res, "Invalid data value. Please contact the administrator.", null, 500);
  }

  // JWT errors
  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    return errorResponse(res, "Invalid or expired token", null, 401);
  }

  // Check for authentication/authorization errors and return 401 instead of 500
  const lowerMessage = err.message?.toLowerCase() || "";
  if (
    lowerMessage.includes("invalid credentials") ||
    lowerMessage.includes("invalid password") ||
    lowerMessage.includes("authentication failed") ||
    lowerMessage.includes("unauthorized") ||
    lowerMessage.includes("not authenticated") ||
    lowerMessage.includes("account is disabled")
  ) {
    return errorResponse(res, err.message || "Authentication failed", null, 401);
  }

  // Check for "not found" errors and return 404 instead of 500
  if (
    lowerMessage.includes("not found") ||
    lowerMessage.includes("does not exist") ||
    lowerMessage.includes("not exist")
  ) {
    return errorResponse(res, err.message || "Resource not found", null, 404);
  }

  // Default error
  const statusCode = (err as any).statusCode || 500;
  const message = err.message || "Internal server error";

  return errorResponse(res, message, null, statusCode);
};

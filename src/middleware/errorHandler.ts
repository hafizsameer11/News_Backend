import { Request, Response, NextFunction } from "express";
import { errorResponse } from "@/utils/response";
import { logger } from "@/utils/logger";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";

/**
 * Global Error Handler Middleware
 * Handles all errors thrown in the application
 */
export const errorHandler = (err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error("Error:", err);

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
    return errorResponse(res, "Database error", err.message, 500);
  }

  // JWT errors
  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    return errorResponse(res, "Invalid or expired token", null, 401);
  }

  // Default error
  const statusCode = (err as any).statusCode || 500;
  const message = err.message || "Internal server error";

  return errorResponse(res, message, null, statusCode);
};

import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";
import { errorResponse } from "@/utils/response";

/**
 * Validation Middleware Protocol
 * Validates request body/query/params using Zod schema
 * Must run BEFORE authGuard
 */
export const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      return next();
    } catch (error: any) {
      if (error.errors) {
        return errorResponse(res, "Validation failed", error.errors, 422);
      }
      return errorResponse(res, "Validation error", error.message, 422);
    }
  };
};

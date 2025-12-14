import { Request, Response, NextFunction } from "express";
import { Controller } from "@/types/global.types";

/**
 * AsyncHandler Protocol
 * Wraps async controller functions to catch errors and pass them to error handler
 */
export const asyncHandler = (fn: Controller) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

import { Request, Response, NextFunction } from "express";
import { ROLE } from "./enums";

// Extend Express Request to include user from JWT
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: ROLE;
  };
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: any;
}

// Controller Type - accepts Response returns since controllers use successResponse/errorResponse
export type Controller = (
  req: AuthenticatedRequest | Request,
  res: Response,
  next: NextFunction
) => Promise<Response | void> | Response | void;

// Service Type
export type ServiceMethod<T = any, R = any> = (params: T) => Promise<R>;

// Repository Type
export type RepositoryMethod<T = any, R = any> = (params: T) => Promise<R>;

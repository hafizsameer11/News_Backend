import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "@/types/global.types";
import { ROLE } from "@/types/enums";
import { verifyToken } from "@/utils/jwt";
import { errorResponse } from "@/utils/response";

/**
 * Optional Auth Middleware
 * Extracts user from JWT if token is present, but doesn't fail if no token
 * Useful for routes that work for both authenticated and public users
 */
export const optionalAuth = () => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    try {
      // Extract token from Authorization header
      const authHeader = req.headers.authorization;

      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.substring(7);

        try {
          // Verify token
          const decoded = verifyToken(token);

          // Attach user to request
          req.user = {
            id: decoded.id,
            email: decoded.email,
            role: decoded.role,
          };
        } catch (error) {
          // Token invalid, but continue without user (public access)
          // Don't attach user to request
        }
      }
      // No token provided, continue without user (public access)

      next();
    } catch (error: any) {
      // Continue even if there's an error (public access)
      next();
    }
  };
};

/**
 * AuthGuard Protocol
 * Supports uppercase role enums
 * Reads user from decoded JWT
 * Rejects unauthorized requests
 */
export const authGuard = (allowedRoles: ROLE[] = []) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      // Extract token from Authorization header
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return errorResponse(res, "No token provided", null, 401);
      }

      const token = authHeader.substring(7);

      // Verify token
      const decoded = verifyToken(token);

      // Attach user to request
      req.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
      };

      // Check role authorization if roles are specified
      if (allowedRoles.length > 0) {
        if (!allowedRoles.includes(decoded.role)) {
          return errorResponse(
            res,
            "Insufficient permissions",
            { required: allowedRoles, provided: decoded.role },
            403
          );
        }
      }

      return next();
    } catch (error: any) {
      return errorResponse(res, error.message || "Authentication failed", null, 401);
    }
  };
};

import jwt, { SignOptions } from "jsonwebtoken";
import env from "@/config/env";
import { ROLE } from "@/types/enums";

export interface JWTPayload {
  id: string;
  email: string;
  role: ROLE;
}

/**
 * Generate JWT token
 */
export const generateToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as SignOptions);
};

/**
 * Verify JWT token
 */
export const verifyToken = (token: string): JWTPayload => {
  try {
    return jwt.verify(token, env.JWT_SECRET) as JWTPayload;
  } catch (error) {
    throw new Error("Invalid or expired token");
  }
};

import { Response } from "express";
import { ApiResponse } from "@/types/global.types";
import { serializeBigInt } from "./serialize";

/**
 * Send a successful API response
 */
export const successResponse = <T>(
  res: Response,
  message: string,
  data?: T,
  statusCode: number = 200
): Response<ApiResponse<T>> => {
  // Serialize BigInt values before JSON.stringify
  const serializedData = data ? serializeBigInt(data) : undefined;

  return res.status(statusCode).json({
    success: true,
    message,
    data: serializedData,
  });
};

/**
 * Send an error API response
 */
export const errorResponse = (
  res: Response,
  message: string,
  errors?: any,
  statusCode: number = 400
): Response<ApiResponse> => {
  // Serialize BigInt values before JSON.stringify
  const serializedErrors = errors ? serializeBigInt(errors) : undefined;

  return res.status(statusCode).json({
    success: false,
    message,
    errors: serializedErrors,
  });
};

import { z } from "zod";

/**
 * Validator for adding a new city
 */
export const addCitySchema = z.object({
  body: z.object({
    name: z.string().min(1, "City name is required"),
    apiId: z.string().optional(),
  }),
});

/**
 * Validator for getting weather by city ID
 */
export const getWeatherSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid city ID format"),
  }),
});

/**
 * Validator for removing a city
 */
export const removeCitySchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid city ID format"),
  }),
});

import { z } from "zod";

/**
 * Validator for tracking user behavior events
 */
export const trackEventValidator = z.object({
  body: z.object({
    eventType: z.string().min(1, "Event type is required").max(100, "Event type is too long"),
    eventData: z.record(z.any()).optional(),
  }),
});

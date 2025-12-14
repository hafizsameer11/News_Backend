import { z } from "zod";

/**
 * Validator for connecting social account (manual token entry)
 */
export const connectAccountValidator = z.object({
  body: z.object({
    platform: z.enum(["FACEBOOK", "INSTAGRAM"]),
    token: z.string().min(1, "Access token is required"),
    accountId: z.string().min(1, "Account ID is required"),
    name: z.string().min(1, "Account name is required"),
  }),
});

/**
 * Validator for OAuth callback
 */
export const oauthCallbackValidator = z.object({
  query: z.object({
    code: z.string().optional(),
    state: z.string().optional(),
    error: z.string().optional(),
    error_reason: z.string().optional(),
    error_description: z.string().optional(),
  }),
});

/**
 * Validator for posting to social media
 */
export const postToSocialValidator = z.object({
  body: z.object({
    platforms: z.array(z.enum(["FACEBOOK", "INSTAGRAM"])).optional(),
    scheduledFor: z.string().datetime().optional(), // ISO 8601 datetime string
  }),
  params: z.object({
    newsId: z.string().uuid("Invalid news ID format"),
  }),
});

/**
 * Validator for webhook verification (GET)
 */
export const webhookVerificationValidator = z.object({
  query: z.object({
    "hub.mode": z.string(),
    "hub.verify_token": z.string(),
    "hub.challenge": z.string(),
  }),
});

/**
 * Validator for webhook events (POST)
 */
export const webhookEventValidator = z.object({
  body: z.object({
    object: z.string(),
    entry: z.array(
      z.object({
        id: z.string(),
        time: z.number(),
        messaging: z.array(z.any()).optional(),
        changes: z
          .array(
            z.object({
              value: z.any(),
              field: z.string(),
            })
          )
          .optional(),
      })
    ),
  }),
});

/**
 * Validator for getting post engagement
 */
export const getPostEngagementValidator = z.object({
  params: z.object({
    postLogId: z.string().uuid("Invalid post log ID format"),
  }),
});

/**
 * Validator for testing account connection
 */
export const testConnectionValidator = z.object({
  params: z.object({
    accountId: z.string().uuid("Invalid account ID format"),
  }),
});

/**
 * Validator for refreshing account token manually
 */
export const refreshTokenValidator = z.object({
  params: z.object({
    accountId: z.string().uuid("Invalid account ID format"),
  }),
});

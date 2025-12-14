import { z } from "zod";
import { MIN_AD_DURATION_DAYS, MAX_AD_DURATION_DAYS } from "@/config/ad-pricing";

// Define enums manually since Prisma client may not be generated yet
const AdTypeEnum = z.enum([
  "BANNER_TOP",
  "BANNER_SIDE",
  "INLINE",
  "FOOTER",
  "SLIDER",
  "TICKER",
  "POPUP",
  "STICKY",
]);

const AdStatusEnum = z.enum(["PENDING", "ACTIVE", "PAUSED", "EXPIRED", "REJECTED"]);

// Valid position values per ad type
const POSITION_VALUES = [
  "HEADER",
  "HEADER_LEADERBOARD",
  "SIDEBAR",
  "SIDEBAR_RECT",
  "INLINE_ARTICLE",
  "FOOTER",
  "MOBILE",
] as const;

const PositionEnum = z.enum(POSITION_VALUES as any);

// Custom date validation
const dateRangeValidation = z
  .object({
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
  })
  .refine(
    (data) => {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      return end > start;
    },
    {
      message: "End date must be after start date",
      path: ["endDate"],
    }
  )
  .refine(
    (data) => {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24));
      return days >= MIN_AD_DURATION_DAYS;
    },
    {
      message: `Ad duration must be at least ${MIN_AD_DURATION_DAYS} day(s)`,
      path: ["endDate"],
    }
  )
  .refine(
    (data) => {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24));
      return days <= MAX_AD_DURATION_DAYS;
    },
    {
      message: `Ad duration cannot exceed ${MAX_AD_DURATION_DAYS} days`,
      path: ["endDate"],
    }
  );

export const createAdValidator = z
  .object({
    body: z
      .object({
        title: z.string().min(3, "Title must be at least 3 characters"),
        type: AdTypeEnum,
        imageUrl: z
          .string()
          .url("Invalid image URL")
          .max(2048, "Image URL is too long (max 2048 characters)"),
        targetLink: z
          .string()
          .url("Invalid target link URL")
          .max(2048, "Target link URL is too long (max 2048 characters)"),
        position: PositionEnum.optional(),
        startDate: z.string().datetime("Invalid start date format"),
        endDate: z.string().datetime("Invalid end date format"),
        price: z.number().positive().optional(), // Optional as it might be calculated
      })
      .and(dateRangeValidation),
  })
  .refine(
    (data) => {
      // Validate position matches ad type (basic validation)
      if (data.body.position) {
        const position = data.body.position;
        const type = data.body.type;

        // Basic compatibility checks
        if (type === "BANNER_TOP" && !position.includes("HEADER")) {
          return false;
        }
        if (type === "BANNER_SIDE" && !position.includes("SIDEBAR")) {
          return false;
        }
        if (type === "FOOTER" && !position.includes("FOOTER")) {
          return false;
        }
      }
      return true;
    },
    {
      message: "Position is not compatible with ad type",
      path: ["body", "position"],
    }
  );

export const updateAdValidator = z
  .object({
    params: z.object({
      id: z.string().uuid("Invalid ad ID format"),
    }),
    body: z
      .object({
        title: z.string().min(3, "Title must be at least 3 characters").optional(),
        type: AdTypeEnum.optional(),
        imageUrl: z
          .string()
          .url("Invalid image URL")
          .max(2048, "Image URL is too long (max 2048 characters)")
          .optional(),
        targetLink: z
          .string()
          .url("Invalid target link URL")
          .max(2048, "Target link URL is too long (max 2048 characters)")
          .optional(),
        position: PositionEnum.optional(),
        status: AdStatusEnum.optional(),
        startDate: z.string().datetime("Invalid start date format").optional(),
        endDate: z.string().datetime("Invalid end date format").optional(),
      })
      .refine(
        (data) => {
          // If both dates are provided, validate range
          if (data.startDate && data.endDate) {
            const start = new Date(data.startDate);
            const end = new Date(data.endDate);
            if (end <= start) return false;

            const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24));
            if (days < MIN_AD_DURATION_DAYS || days > MAX_AD_DURATION_DAYS) {
              return false;
            }
          }
          return true;
        },
        {
          message: `Date range must be between ${MIN_AD_DURATION_DAYS} and ${MAX_AD_DURATION_DAYS} days`,
          path: ["endDate"],
        }
      ),
  })
  .refine(
    (data) => {
      // Validate position matches ad type if both are being updated
      if (data.body.position && data.body.type) {
        const position = data.body.position;
        const type = data.body.type;

        if (type === "BANNER_TOP" && !position.includes("HEADER")) {
          return false;
        }
        if (type === "BANNER_SIDE" && !position.includes("SIDEBAR")) {
          return false;
        }
        if (type === "FOOTER" && !position.includes("FOOTER")) {
          return false;
        }
      }
      return true;
    },
    {
      message: "Position is not compatible with ad type",
      path: ["body", "position"],
    }
  );

export const approveAdValidator = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const rejectAdValidator = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    reason: z.string().min(1, "Rejection reason is required"),
  }),
});

import { z } from "zod";

// CRM Register User Validator
export const crmRegisterUserValidator = z.object({
  body: z.object({
    email: z.string().email("Invalid email format"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    name: z.string().min(1, "Name is required"),
    role: z.enum(["EDITOR", "ADVERTISER", "USER"], {
      errorMap: () => ({ message: "Role must be EDITOR, ADVERTISER, or USER" }),
    }),
    companyName: z.string().optional(),
  }),
});

// CRM Create News Validator
export const crmCreateNewsValidator = z.object({
  body: z.object({
    title: z.string().min(1, "Title is required").max(500, "Title must not exceed 500 characters"),
    slug: z.string().optional(),
    summary: z.string().optional(),
    content: z.string().min(1, "Content is required"),
    categoryId: z.string().uuid("Invalid category ID"),
    status: z.enum(["DRAFT", "PUBLISHED"]).default("PUBLISHED"),
    isFeatured: z.boolean().optional().default(false),
    isBreaking: z.boolean().optional().default(false),
    tags: z.array(z.string()).optional(),
    mainImage: z.string().url("Invalid image URL").optional(),
  }),
});

// CRM Create Ad Validator
export const crmCreateAdValidator = z.object({
  body: z.object({
    title: z.string().min(1, "Title is required"),
    type: z.enum([
      "BANNER_TOP",
      "BANNER_SIDE",
      "INLINE",
      "FOOTER",
      "SLIDER",
      "SLIDER_TOP",
      "TICKER",
      "POPUP",
      "STICKY",
    ]),
    imageUrl: z.string().url("Invalid image URL").max(2048, "Image URL is too long"),
    targetLink: z
      .union([
        z.string().url("Invalid target link URL").max(2048, "Target link URL is too long"),
        z.literal(""),
        z.null(),
      ])
      .optional()
      .transform((val) => (val === "" || val === null ? undefined : val)),
    position: z.string().optional(),
    startDate: z.string().datetime("Invalid start date format"),
    endDate: z.string().datetime("Invalid end date format"),
    price: z
      .union([z.number(), z.string()])
      .optional()
      .transform((val) => {
        if (val === undefined || val === null || val === "") return undefined;
        const num = typeof val === "string" ? parseFloat(val) : val;
        return isNaN(num) ? undefined : num;
      })
      .pipe(z.number().positive().optional()),
  }),
});

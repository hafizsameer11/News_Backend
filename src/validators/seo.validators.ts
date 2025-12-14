import { z } from "zod";

export const seoValidators = {
  newsSlug: z.object({
    params: z.object({
      slug: z
        .string()
        .min(1, "Slug is required")
        .regex(/^[a-z0-9-]+$/, "Invalid slug format"),
    }),
  }),

  categorySlug: z.object({
    params: z.object({
      slug: z
        .string()
        .min(1, "Slug is required")
        .regex(/^[a-z0-9-]+$/, "Invalid slug format"),
    }),
  }),
};

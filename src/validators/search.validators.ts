import { z } from "zod";

export const searchValidators = {
  search: z.object({
    query: z.object({
      q: z
        .string()
        .min(2, "Search query must be at least 2 characters")
        .max(200, "Search query too long"),
      type: z.enum(["news", "category", "transport", "all"]).optional(),
      categoryId: z
        .union([
          z.string().uuid("Invalid category ID format"),
          z.array(z.string().uuid("Invalid category ID format")),
        ])
        .optional(),
      dateFrom: z.string().datetime("Invalid date format").optional(),
      dateTo: z.string().datetime("Invalid date format").optional(),
      sort: z.enum(["relevance", "date", "views"]).optional(),
      page: z
        .string()
        .transform((val) => parseInt(val, 10))
        .pipe(z.number().int().min(1))
        .optional(),
      limit: z
        .string()
        .transform((val) => parseInt(val, 10))
        .pipe(z.number().int().min(1).max(100))
        .optional(),
    }),
  }),
};

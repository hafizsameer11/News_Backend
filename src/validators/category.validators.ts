import { z } from "zod";

export const createCategoryValidator = z.object({
  body: z.object({
    nameEn: z.string().min(2, "English name is required"),
    nameIt: z.string().min(2, "Italian name is required"),
    slug: z
      .string()
      .min(2)
      .regex(/^[a-z0-9-]+$/, "Slug must be lowercase with hyphens"),
    description: z.string().optional(),
    parentId: z.string().uuid().optional(),
    order: z.number().int().optional(),
  }),
});

export const updateCategoryValidator = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    nameEn: z.string().min(2).optional(),
    nameIt: z.string().min(2).optional(),
    slug: z
      .string()
      .min(2)
      .regex(/^[a-z0-9-]+$/)
      .optional(),
    description: z.string().optional(),
    parentId: z.string().uuid().nullable().optional(),
    order: z.number().int().optional(),
  }),
});

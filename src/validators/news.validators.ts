import { z } from "zod";
import { NEWS_STATUS } from "@/types/enums";

export const createNewsValidator = z.object({
  body: z.object({
    title: z.string().min(5, "Title is required"),
    slug: z
      .string()
      .min(5)
      .regex(/^[a-z0-9-]+$/, "Slug must be lowercase with hyphens"),
    summary: z.string().min(10, "Summary is required"),
    content: z.string().min(20, "Content is required"),
    categoryId: z.string().uuid("Category ID must be a valid UUID"),
    mainImage: z.string().url("Main image URL is invalid").optional(),
    tags: z.string().optional(),
    status: z.nativeEnum(NEWS_STATUS).optional().default(NEWS_STATUS.DRAFT),
    isBreaking: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
    isTG: z.boolean().optional(),
    scheduledFor: z.string().datetime().optional(),
    publishedAt: z.string().datetime().optional(), // Retroactive publishing date
  }),
});

export const updateNewsValidator = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    title: z.string().min(5).optional(),
    slug: z
      .string()
      .min(5)
      .regex(/^[a-z0-9-]+$/)
      .optional(),
    summary: z.string().min(10).optional(),
    content: z.string().min(20).optional(),
    categoryId: z.string().uuid().optional(),
    mainImage: z.string().url().optional(),
    tags: z.string().optional(),
    status: z.nativeEnum(NEWS_STATUS).optional(),
    isBreaking: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
    isTG: z.boolean().optional(),
    scheduledFor: z.string().datetime().nullable().optional(),
    publishedAt: z.string().datetime().nullable().optional(), // Retroactive publishing date
  }),
});

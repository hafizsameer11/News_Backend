import { z } from "zod";

export const createHomepageSectionValidator = z.object({
  body: z.object({
    type: z.enum([
      "HERO_SLIDER",
      "BREAKING_TICKER",
      "FEATURED_SECTION",
      "CATEGORY_BLOCK",
      "MANUAL_LIST",
    ]),
    title: z.string().optional(),
    dataSource: z.string().optional(),
    config: z.any().optional(),
    order: z.number().int().optional(),
    isActive: z.boolean().optional(),
  }),
});

export const updateHomepageSectionValidator = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    title: z.string().optional(),
    dataSource: z.string().optional(),
    config: z.any().optional(),
    order: z.number().int().optional(),
    isActive: z.boolean().optional(),
  }),
});

export const reorderSectionsValidator = z.object({
  body: z.object({
    sectionIds: z.array(z.string().uuid()).min(1),
  }),
});

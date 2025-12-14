import { z } from "zod";
import { ROLE } from "@/types/enums";

export const createUserValidator = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(6),
    name: z.string().min(2),
    role: z.nativeEnum(ROLE),
    companyName: z.string().optional(),
    categoryIds: z.array(z.string().uuid()).optional(), // For Editor role
    socialPostingAllowed: z.boolean().optional(),
  }),
});

export const updateUserValidator = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    name: z.string().min(2).optional(),
    email: z.string().email().optional(),
    role: z.nativeEnum(ROLE).optional(),
    isActive: z.boolean().optional(),
    socialPostingAllowed: z.boolean().optional(),
    companyName: z.string().optional(),
    categoryIds: z.array(z.string().uuid()).optional(), // For Editor role
  }),
});

export const assignCategoriesValidator = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    categoryIds: z.array(z.string().uuid()),
  }),
});

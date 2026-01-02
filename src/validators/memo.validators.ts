import { z } from "zod";

export const createMemoValidator = z.object({
  body: z.object({
    type: z.enum(["NOTE", "REMINDER", "TASK", "FOLLOW_UP"]),
    message: z.string().min(1, "Message cannot be empty").max(5000, "Message too long"),
    when: z.number().int().min(0).optional().default(0),
    userId: z.string().uuid("Invalid user ID"),
  }),
});

export const getMemosByUserValidator = z.object({
  params: z.object({
    userId: z.string().uuid("Invalid user ID"),
  }),
});

export const deleteMemoValidator = z.object({
  params: z.object({
    id: z.string().uuid("Invalid memo ID"),
  }),
});



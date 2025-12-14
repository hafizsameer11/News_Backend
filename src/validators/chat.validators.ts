import { z } from "zod";

export const sendMessageValidator = z.object({
  body: z.object({
    receiverId: z.string().uuid("Invalid receiver ID"),
    message: z.string().min(1, "Message cannot be empty").max(5000, "Message too long"),
  }),
});

export const getMessagesValidator = z.object({
  params: z.object({
    partnerId: z.string().uuid("Invalid partner ID"),
  }),
  query: z.object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1)),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 50)),
  }),
});

export const markAsReadValidator = z.object({
  params: z.object({
    partnerId: z.string().uuid("Invalid partner ID"),
  }),
});

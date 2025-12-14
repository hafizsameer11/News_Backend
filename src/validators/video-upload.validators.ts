import { z } from "zod";

export const initiateUploadValidator = z.object({
  body: z.object({
    filename: z.string().min(1, "Filename is required"),
    totalChunks: z.number().int().positive("Total chunks must be a positive integer"),
    totalSize: z.number().int().positive("Total size must be a positive integer"),
  }),
});

export const uploadChunkValidator = z.object({
  body: z.object({
    uploadId: z.string().uuid("Invalid uploadId format"),
    chunkNumber: z.number().int().min(0, "Chunk number must be non-negative"),
    totalChunks: z.number().int().positive("Total chunks must be a positive integer"),
  }),
});

export const completeUploadValidator = z.object({
  body: z.object({
    uploadId: z.string().uuid("Invalid uploadId format"),
    caption: z.string().optional(),
    newsId: z.string().uuid("Invalid newsId format").optional(),
  }),
});

export const cancelUploadValidator = z.object({
  body: z.object({
    uploadId: z.string().uuid("Invalid uploadId format"),
  }),
});

export const getProgressValidator = z.object({
  params: z.object({
    uploadId: z.string().uuid("Invalid uploadId format"),
  }),
});

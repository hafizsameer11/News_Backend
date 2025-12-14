import { Request, Response } from "express";
import { VideoUploadService } from "@/services/video-upload.service";
import { successResponse, errorResponse } from "@/utils/response";

const videoUploadService = new VideoUploadService();

export const videoUploadController = {
  initiate: async (req: Request, res: Response) => {
    const { filename, totalChunks, totalSize } = req.body;

    if (!filename || !totalChunks || !totalSize) {
      return errorResponse(
        res,
        "Missing required fields: filename, totalChunks, totalSize",
        null,
        400
      );
    }

    const result = await videoUploadService.initiateUpload(filename, totalChunks, totalSize);
    return successResponse(res, "Upload initiated", result, 201);
  },

  uploadChunk: async (req: Request, res: Response) => {
    const { uploadId, chunkNumber, totalChunks } = req.body;

    if (!uploadId || chunkNumber === undefined || !totalChunks) {
      return errorResponse(
        res,
        "Missing required fields: uploadId, chunkNumber, totalChunks",
        null,
        400
      );
    }

    if (!req.file || !req.file.buffer) {
      return errorResponse(res, "Chunk data is required", null, 400);
    }

    const result = await videoUploadService.uploadChunk(
      uploadId,
      chunkNumber,
      req.file.buffer,
      totalChunks
    );
    return successResponse(res, "Chunk uploaded", result);
  },

  complete: async (req: Request, res: Response) => {
    const { uploadId } = req.body;
    const { caption, newsId } = req.body;

    if (!uploadId) {
      return errorResponse(res, "uploadId is required", null, 400);
    }

    const result = await videoUploadService.completeUpload(uploadId, caption, newsId);
    return successResponse(res, "Upload completed", result);
  },

  cancel: async (req: Request, res: Response) => {
    const { uploadId } = req.body;

    if (!uploadId) {
      return errorResponse(res, "uploadId is required", null, 400);
    }

    await videoUploadService.cancelUpload(uploadId);
    return successResponse(res, "Upload cancelled");
  },

  getProgress: async (req: Request, res: Response) => {
    const { uploadId } = req.params;

    if (!uploadId) {
      return errorResponse(res, "uploadId is required", null, 400);
    }

    const progress = videoUploadService.getUploadProgress(uploadId);
    if (!progress) {
      return errorResponse(res, "Upload session not found", null, 404);
    }

    return successResponse(res, "Upload progress retrieved", progress);
  },
};

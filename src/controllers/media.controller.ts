import { Request, Response } from "express";
import { MediaService } from "@/services/media.service";
import { successResponse, errorResponse } from "@/utils/response";
import fs from "fs";
import path from "path";

const mediaService = new MediaService();

export const mediaController = {
  upload: async (req: Request, res: Response) => {
    if (!req.file) {
      return errorResponse(res, "No file uploaded", null, 400);
    }

    // Verify file was actually saved to disk
    const filePath = req.file.path || path.join(req.file.destination || "uploads", req.file.filename);
    const absoluteFilePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
    
    if (!fs.existsSync(absoluteFilePath)) {
      return errorResponse(res, "File was not saved to disk", { path: absoluteFilePath }, 500);
    }

    const { caption, newsId } = req.body;
    const uploaderId = (req as any).user?.id; // Get user ID from authenticated request
    const uploaderRole = (req as any).user?.role; // Get user role from authenticated request
    const result = await mediaService.saveMedia(
      req.file,
      caption,
      newsId,
      uploaderId,
      uploaderRole
    );

    // Verify file still exists after saving to database
    if (!fs.existsSync(absoluteFilePath)) {
      return errorResponse(res, "File was deleted after upload", { path: absoluteFilePath }, 500);
    }

    return successResponse(res, "File uploaded successfully", result, 201);
  },

  getAll: async (req: Request, res: Response) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const userId = (req as any).user?.id; // Get user ID from authenticated request
    const userRole = (req as any).user?.role; // Get user role from authenticated request
    const result = await mediaService.getAllMedia(page, limit, userId, userRole);
    return successResponse(res, "Media retrieved", result);
  },

  updateStatus: async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !["PENDING", "PROCESSING", "COMPLETED", "FAILED"].includes(status)) {
      return errorResponse(res, "Invalid status", null, 400);
    }

    const result = await mediaService.updateProcessingStatus(id, status);
    return successResponse(res, "Media status updated", result);
  },

  delete: async (req: Request, res: Response) => {
    const mediaId = req.params.id;
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role;

    // Check if user can delete this media
    const canDelete = await mediaService.canUserDeleteMedia(mediaId, userId, userRole);
    if (!canDelete) {
      return errorResponse(res, "You don't have permission to delete this media", null, 403);
    }

    await mediaService.deleteMedia(mediaId);
    return successResponse(res, "Media deleted");
  },

  streamVideo: async (req: Request, res: Response): Promise<Response | void> => {
    const { id } = req.params;
    const media = await mediaService.getMediaById(id);

    if (!media) {
      return errorResponse(res, "Media not found", null, 404);
    }

    if (media.type !== "VIDEO") {
      return errorResponse(res, "Media is not a video", null, 400);
    }

    if (!media.url) {
      return errorResponse(res, "Media URL not found", null, 404);
    }

    // Extract relative path from absolute URL if needed
    let relativePath = media.url;
    if (media.url.startsWith("http://") || media.url.startsWith("https://")) {
      try {
        const urlObj = new URL(media.url);
        relativePath = urlObj.pathname;
      } catch {
        // If URL parsing fails, try to extract path manually
        const pathMatch = media.url.match(/\/uploads\/.*/);
        relativePath = pathMatch ? pathMatch[0] : media.url;
      }
    }

    // Get file path (remove leading slash if present)
    const filePath = path.join(
      process.cwd(),
      relativePath.startsWith("/") ? relativePath.slice(1) : relativePath
    );

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return errorResponse(res, "Video file not found", null, 404);
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      // Parse range header
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;
      const file = fs.createReadStream(filePath, { start, end });
      const head = {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize,
        "Content-Type": "video/mp4",
      };
      res.writeHead(206, head);
      file.pipe(res);
      return;
    } else {
      // Send entire file
      const head = {
        "Content-Length": fileSize,
        "Content-Type": "video/mp4",
        "Accept-Ranges": "bytes",
      };
      res.writeHead(200, head);
      fs.createReadStream(filePath).pipe(res);
      return;
    }
  },

  checkStatus: async (req: Request, res: Response) => {
    const { url } = req.query;

    if (!url || typeof url !== "string") {
      return errorResponse(res, "URL parameter is required", null, 400);
    }

    // Find media record by URL
    const media = await mediaService.getMediaByUrl(url);

    if (!media) {
      return successResponse(res, "Media not found in library", {
        url,
        status: null,
        exists: false,
      });
    }

    return successResponse(res, "Media status retrieved", {
      url,
      status: media.processingStatus,
      exists: true,
      type: media.type,
    });
  },
};

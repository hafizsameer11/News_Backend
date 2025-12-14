import { Response } from "express";
import { BookmarkService } from "@/services/bookmark.service";
import { successResponse } from "@/utils/response";
import { AuthenticatedRequest } from "@/types/global.types";

const bookmarkService = new BookmarkService();

export const bookmarkController = {
  create: async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new Error("Not authenticated");
    }
    const { newsId } = req.body;
    const result = await bookmarkService.saveBookmark(req.user.id, newsId);
    return successResponse(res, "Bookmark saved", result, 201);
  },

  getAll: async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new Error("Not authenticated");
    }
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const result = await bookmarkService.getUserBookmarks(req.user.id, page, limit);
    return successResponse(res, "Bookmarks retrieved", result);
  },

  delete: async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new Error("Not authenticated");
    }
    await bookmarkService.removeBookmark(req.user.id, req.params.id);
    return successResponse(res, "Bookmark removed");
  },

  check: async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new Error("Not authenticated");
    }
    const { newsId } = req.params;
    const isBookmarked = await bookmarkService.isBookmarked(req.user.id, newsId);
    return successResponse(res, "Bookmark status retrieved", { isBookmarked });
  },
};

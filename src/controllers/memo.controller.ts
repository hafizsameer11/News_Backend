import { Response } from "express";
import { MemoService } from "@/services/memo.service";
import { successResponse } from "@/utils/response";
import { AuthenticatedRequest } from "@/types/global.types";

const memoService = new MemoService();

export const memoController = {
  /**
   * Create a new memo for a user (admin only)
   */
  createMemo: async (req: AuthenticatedRequest, res: Response) => {
    const { type, message, when, userId } = req.body;
    const result = await memoService.createMemo({
      type,
      message,
      when: Number(when) || 0,
      userId,
      createdById: req.user!.id,
    });
    return successResponse(res, "Memo created successfully", result, 201);
  },

  /**
   * Get all memos for a specific user (admin only)
   */
  getMemosByUser: async (req: AuthenticatedRequest, res: Response) => {
    const { userId } = req.params;
    const result = await memoService.getMemosByUser(userId);
    return successResponse(res, "Memos retrieved successfully", result);
  },

  /**
   * Delete a memo (admin only)
   */
  deleteMemo: async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    await memoService.deleteMemo(id, req.user!.id);
    return successResponse(res, "Memo deleted successfully");
  },
};



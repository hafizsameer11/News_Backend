import { Response } from "express";
import { ChatService } from "@/services/chat.service";
import { successResponse } from "@/utils/response";
import { AuthenticatedRequest } from "@/types/global.types";

const chatService = new ChatService();

export const chatController = {
  /**
   * Get all conversations for the current user
   */
  getConversations: async (req: AuthenticatedRequest, res: Response) => {
    const result = await chatService.getConversations(req.user!.id, req.user!.role);
    return successResponse(res, "Conversations retrieved successfully", result);
  },

  /**
   * Get messages between current user and a partner
   */
  getMessages: async (req: AuthenticatedRequest, res: Response) => {
    const { partnerId } = req.params;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;

    const result = await chatService.getMessages(req.user!.id, partnerId, page, limit);
    return successResponse(res, "Messages retrieved successfully", result);
  },

  /**
   * Send a message
   */
  sendMessage: async (req: AuthenticatedRequest, res: Response) => {
    const { receiverId, message } = req.body;
    const result = await chatService.sendMessage(req.user!.id, receiverId, message);
    return successResponse(res, "Message sent successfully", result, 201);
  },

  /**
   * Mark messages as read
   */
  markAsRead: async (req: AuthenticatedRequest, res: Response) => {
    const { partnerId } = req.params;
    await chatService.markAsRead(req.user!.id, partnerId);
    return successResponse(res, "Messages marked as read");
  },

  /**
   * Get unread message count
   */
  getUnreadCount: async (req: AuthenticatedRequest, res: Response) => {
    const count = await chatService.getUnreadCount(req.user!.id);
    return successResponse(res, "Unread count retrieved successfully", { count });
  },

  /**
   * Get all users that admin can chat with (admin only)
   */
  getChatUsers: async (req: AuthenticatedRequest, res: Response) => {
    const result = await chatService.getChatUsers(req.user!.id);
    return successResponse(res, "Chat users retrieved successfully", result);
  },

  /**
   * Get available admins for users to chat with
   */
  getAvailableAdmins: async (_req: AuthenticatedRequest, res: Response) => {
    const result = await chatService.getAvailableAdmins();
    return successResponse(res, "Available admins retrieved successfully", result);
  },
};

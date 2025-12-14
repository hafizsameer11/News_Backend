import { Router } from "express";
import { chatController } from "@/controllers/chat.controller";
import { validate } from "@/middleware/validate";
import { asyncHandler } from "@/middleware/asyncHandler";
import { authGuard } from "@/middleware/authGuard";
import { ROLE } from "@/types/enums";
import {
  sendMessageValidator,
  getMessagesValidator,
  markAsReadValidator,
} from "@/validators/chat.validators";

const router = Router();

// All chat routes require authentication
router.use(authGuard());

// Get all conversations for current user
router.get("/conversations", asyncHandler(chatController.getConversations));

// Get unread message count
router.get("/unread-count", asyncHandler(chatController.getUnreadCount));

// Get all users that admin can chat with (admin only)
router.get(
  "/users",
  authGuard([ROLE.ADMIN, ROLE.SUPER_ADMIN]),
  asyncHandler(chatController.getChatUsers)
);

// Get available admins for users to chat with
router.get("/admins", authGuard(), asyncHandler(chatController.getAvailableAdmins));

// Get messages between current user and a partner
router.get(
  "/messages/:partnerId",
  validate(getMessagesValidator),
  asyncHandler(chatController.getMessages)
);

// Send a message
router.post("/send", validate(sendMessageValidator), asyncHandler(chatController.sendMessage));

// Mark messages as read
router.post(
  "/read/:partnerId",
  validate(markAsReadValidator),
  asyncHandler(chatController.markAsRead)
);

export default router;

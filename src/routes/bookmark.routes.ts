import { Router } from "express";
import { bookmarkController } from "@/controllers/bookmark.controller";
import { validate } from "@/middleware/validate";
import { asyncHandler } from "@/middleware/asyncHandler";
import { authGuard } from "@/middleware/authGuard";
import { z } from "zod";

const router = Router();

// All bookmark routes require authentication
router.use(authGuard());

const createBookmarkValidator = z.object({
  body: z.object({
    newsId: z.string().uuid("Invalid news ID"),
  }),
});

router.post("/", validate(createBookmarkValidator), asyncHandler(bookmarkController.create));

router.get("/", asyncHandler(bookmarkController.getAll));

router.get("/check/:newsId", asyncHandler(bookmarkController.check));

router.delete("/:id", asyncHandler(bookmarkController.delete));

export default router;

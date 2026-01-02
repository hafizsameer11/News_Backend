import { Router } from "express";
import { memoController } from "@/controllers/memo.controller";
import { validate } from "@/middleware/validate";
import { asyncHandler } from "@/middleware/asyncHandler";
import { authGuard } from "@/middleware/authGuard";
import { ROLE } from "@/types/enums";
import {
  createMemoValidator,
  getMemosByUserValidator,
  deleteMemoValidator,
} from "@/validators/memo.validators";

const router = Router();

// All memo routes require authentication and admin role
router.use(authGuard([ROLE.ADMIN, ROLE.SUPER_ADMIN]));

// Create a new memo
router.post("/", validate(createMemoValidator), asyncHandler(memoController.createMemo));

// Get all memos for a specific user
router.get(
  "/user/:userId",
  validate(getMemosByUserValidator),
  asyncHandler(memoController.getMemosByUser)
);

// Delete a memo
router.delete(
  "/:id",
  validate(deleteMemoValidator),
  asyncHandler(memoController.deleteMemo)
);

export default router;



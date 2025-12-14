import { Router } from "express";
import { userController } from "@/controllers/user.controller";
import { validate } from "@/middleware/validate";
import { asyncHandler } from "@/middleware/asyncHandler";
import { authGuard } from "@/middleware/authGuard";
import { ROLE } from "@/types/enums";
import {
  createUserValidator,
  updateUserValidator,
  assignCategoriesValidator,
} from "@/validators/user.validators";

const router = Router();

// Protect all user routes - only Admin/Super Admin can access
router.use(authGuard([ROLE.ADMIN, ROLE.SUPER_ADMIN]));

router.get("/", asyncHandler(userController.getAll));
router.get("/:id", asyncHandler(userController.getOne));

router.post("/", validate(createUserValidator), asyncHandler(userController.create));

router.patch("/:id", validate(updateUserValidator), asyncHandler(userController.update));

router.delete("/:id", asyncHandler(userController.delete));

// Assign categories (for Editors)
router.post(
  "/:id/categories",
  validate(assignCategoriesValidator),
  asyncHandler(userController.assignCategories)
);

export default router;

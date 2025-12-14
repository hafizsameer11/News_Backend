import { Router } from "express";
import { transportController } from "@/controllers/transport.controller";
import { asyncHandler } from "@/middleware/asyncHandler";
import { authGuard } from "@/middleware/authGuard";
import { ROLE } from "@/types/enums";

const router = Router();

// Public
router.get("/", asyncHandler(transportController.getAll));

// Admin
router.use(authGuard([ROLE.ADMIN, ROLE.SUPER_ADMIN]));

router.post("/", asyncHandler(transportController.create));
router.patch("/:id", asyncHandler(transportController.update));
router.delete("/:id", asyncHandler(transportController.delete));

export default router;

import { Router } from "express";
import { authController } from "@/controllers/auth.controller";
import { validate } from "@/middleware/validate";
import {
  loginValidator,
  registerValidator,
  verifyEmailValidator,
  resendVerificationValidator,
  updateProfileValidator,
  changePasswordValidator,
} from "@/validators/auth.validators";
import { asyncHandler } from "@/middleware/asyncHandler";
import { authGuard } from "@/middleware/authGuard";

const router = Router();

/**
 * @openapi
 * tags:
 *   name: Auth
 *   description: Authentication management
 */

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 6
 *               name:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [ADMIN, EDITOR, ADVERTISER, USER]
 *     responses:
 *       201:
 *         description: Registration successful
 */
router.post("/register", validate(registerValidator), asyncHandler(authController.register));

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                     user:
 *                       type: object
 */
router.post("/login", validate(loginValidator), asyncHandler(authController.login));

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get current user profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved
 */
router.get(
  "/me",
  authGuard(), // Any authenticated user
  asyncHandler(authController.getMe)
);

/**
 * @openapi
 * /auth/verify-email:
 *   post:
 *     tags: [Auth]
 *     summary: Verify email with token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Email verified successfully
 */
router.post(
  "/verify-email",
  validate(verifyEmailValidator),
  asyncHandler(authController.verifyEmail)
);

/**
 * @openapi
 * /auth/resend-verification:
 *   post:
 *     tags: [Auth]
 *     summary: Resend verification email
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Verification email sent
 */
router.post(
  "/resend-verification",
  authGuard(), // Any authenticated user
  validate(resendVerificationValidator),
  asyncHandler(authController.resendVerification)
);

/**
 * @openapi
 * /auth/profile:
 *   patch:
 *     tags: [Auth]
 *     summary: Update own profile
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               avatar:
 *                 type: string
 *                 format: uri
 *     responses:
 *       200:
 *         description: Profile updated successfully
 */
router.patch(
  "/profile",
  authGuard(), // Any authenticated user
  validate(updateProfileValidator),
  asyncHandler(authController.updateProfile)
);

/**
 * @openapi
 * /auth/password:
 *   patch:
 *     tags: [Auth]
 *     summary: Change own password
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *     responses:
 *       200:
 *         description: Password changed successfully
 */
router.patch(
  "/password",
  authGuard(), // Any authenticated user
  validate(changePasswordValidator),
  asyncHandler(authController.changePassword)
);

export default router;

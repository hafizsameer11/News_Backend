import { Router } from "express";
import { crmController } from "@/controllers/crm.controller";
import { validate } from "@/middleware/validate";
import { asyncHandler } from "@/middleware/asyncHandler";
import { authGuard } from "@/middleware/authGuard";
import { ROLE } from "@/types/enums";
import {
  crmRegisterUserValidator,
  crmCreateNewsValidator,
  crmCreateAdValidator,
} from "@/validators/crm.validators";

const router = Router();

/**
 * @openapi
 * tags:
 *   name: CRM
 *   description: CRM Management endpoints for external systems
 */

/**
 * @openapi
 * /crm/users/register:
 *   post:
 *     tags: [CRM]
 *     summary: Register a new user via CRM
 *     description: Creates a new user with specified role. Users created via CRM can create news and ads.
 *     security:
 *       - bearerAuth: []
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
 *               - role
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
 *                 enum: [EDITOR, ADVERTISER, USER]
 *               companyName:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Validation error or email already exists
 *       401:
 *         description: Unauthorized - CRM access required
 */
router.post(
  "/users/register",
  authGuard([ROLE.ADMIN, ROLE.SUPER_ADMIN]), // Only admins can register users via CRM
  validate(crmRegisterUserValidator),
  asyncHandler(crmController.registerUser)
);

/**
 * @openapi
 * /crm/categories:
 *   get:
 *     tags: [CRM]
 *     summary: Get all categories (CRM)
 *     description: Returns list of all categories for news creation
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Categories retrieved successfully
 *       401:
 *         description: Unauthorized - CRM access required
 */
router.get(
  "/categories",
  authGuard([ROLE.ADMIN, ROLE.SUPER_ADMIN, ROLE.EDITOR, ROLE.ADVERTISER]),
  asyncHandler(crmController.getCategories)
);

/**
 * @openapi
 * /crm/news:
 *   post:
 *     tags: [CRM]
 *     summary: Create news article via CRM
 *     description: Creates a news article. CRM users can create news in any category and it will be auto-published.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - content
 *               - categoryId
 *             properties:
 *               title:
 *                 type: string
 *               slug:
 *                 type: string
 *               summary:
 *                 type: string
 *               content:
 *                 type: string
 *               categoryId:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [DRAFT, PUBLISHED]
 *                 default: PUBLISHED
 *               isFeatured:
 *                 type: boolean
 *               isBreaking:
 *                 type: boolean
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               mainImage:
 *                 type: string
 *     responses:
 *       201:
 *         description: News created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized - CRM access required
 */
router.post(
  "/news",
  authGuard([ROLE.ADMIN, ROLE.SUPER_ADMIN, ROLE.EDITOR, ROLE.ADVERTISER]),
  validate(crmCreateNewsValidator),
  asyncHandler(crmController.createNews)
);

/**
 * @openapi
 * /crm/ads:
 *   post:
 *     tags: [CRM]
 *     summary: Create ad via CRM
 *     description: Creates an ad campaign. Ads created via CRM are auto-approved and don't require payment.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - type
 *               - imageUrl
 *               - startDate
 *               - endDate
 *             properties:
 *               title:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [BANNER_TOP, BANNER_SIDE, INLINE, FOOTER, SLIDER, SLIDER_TOP, TICKER, POPUP, STICKY]
 *               imageUrl:
 *                 type: string
 *                 format: uri
 *               targetLink:
 *                 type: string
 *                 format: uri
 *               position:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *               price:
 *                 type: number
 *     responses:
 *       201:
 *         description: Ad created and auto-approved successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized - CRM access required
 */
router.post(
  "/ads",
  authGuard([ROLE.ADMIN, ROLE.SUPER_ADMIN, ROLE.EDITOR, ROLE.ADVERTISER]),
  validate(crmCreateAdValidator),
  asyncHandler(crmController.createAd)
);

export default router;

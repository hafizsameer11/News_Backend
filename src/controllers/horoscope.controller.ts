import { Request, Response } from "express";
import { HoroscopeService } from "@/services/horoscope.service";
import { successResponse } from "@/utils/response";

const horoscopeService = new HoroscopeService();

export const horoscopeController = {
  /**
   * @openapi
   * /api/horoscope/daily:
   *   get:
   *     tags:
   *       - Horoscope
   *     summary: Get daily horoscope for all signs
   *     description: Returns daily horoscope predictions for all 12 zodiac signs
   *     responses:
   *       200:
   *         description: Daily horoscope retrieved
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: "Daily horoscope retrieved"
   *                 data:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                         format: uuid
   *                       sign:
   *                         type: string
   *                         example: "Aries"
   *                       date:
   *                         type: string
   *                         format: date
   *                       content:
   *                         type: string
   *                         example: "Today brings new opportunities..."
   *                       type:
   *                         type: string
   *                         example: "DAILY"
   */
  getDaily: async (_req: Request, res: Response) => {
    const result = await horoscopeService.getDailyHoroscope();
    return successResponse(res, "Daily horoscope retrieved", result);
  },

  /**
   * @openapi
   * /api/horoscope/{sign}:
   *   get:
   *     tags:
   *       - Horoscope
   *     summary: Get horoscope for a specific sign
   *     description: Returns horoscope prediction for a specific zodiac sign (daily or weekly)
   *     parameters:
   *       - in: path
   *         name: sign
   *         required: true
   *         schema:
   *           type: string
   *           enum: [Aries, Taurus, Gemini, Cancer, Leo, Virgo, Libra, Scorpio, Sagittarius, Capricorn, Aquarius, Pisces]
   *         description: Zodiac sign
   *       - in: query
   *         name: type
   *         schema:
   *           type: string
   *           enum: [DAILY, WEEKLY]
   *           default: DAILY
   *         description: Type of horoscope (daily or weekly)
   *     responses:
   *       200:
   *         description: Horoscope retrieved
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: "Horoscope retrieved"
   *                 data:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       format: uuid
   *                     sign:
   *                       type: string
   *                       example: "Aries"
   *                     date:
   *                       type: string
   *                       format: date
   *                     content:
   *                       type: string
   *                       example: "Today brings new opportunities..."
   *                     type:
   *                       type: string
   *                       example: "DAILY"
   *       404:
   *         description: Horoscope not found for the specified sign and date
   */
  getSign: async (req: Request, res: Response) => {
    const type = (req.query.type as "DAILY" | "WEEKLY") || "DAILY";
    const result = await horoscopeService.getHoroscope(req.params.sign, type);
    return successResponse(res, "Horoscope retrieved", result);
  },

  /**
   * @openapi
   * /api/horoscope:
   *   post:
   *     tags:
   *       - Horoscope
   *     summary: Create or update horoscope (Admin only)
   *     description: Create or update horoscope content for a specific sign, date, and type
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - sign
   *               - content
   *               - type
   *             properties:
   *               sign:
   *                 type: string
   *                 enum: [Aries, Taurus, Gemini, Cancer, Leo, Virgo, Libra, Scorpio, Sagittarius, Capricorn, Aquarius, Pisces]
   *                 example: "Aries"
   *               content:
   *                 type: string
   *                 minLength: 10
   *                 example: "Today brings new opportunities for growth and adventure..."
   *               type:
   *                 type: string
   *                 enum: [DAILY, WEEKLY]
   *                 example: "DAILY"
   *               date:
   *                 type: string
   *                 format: date-time
   *                 nullable: true
   *                 description: Date for the horoscope (defaults to today if not provided)
   *     responses:
   *       200:
   *         description: Horoscope updated successfully
   *       201:
   *         description: Horoscope created successfully
   *       400:
   *         description: Invalid request data
   *       401:
   *         description: Unauthorized
   */
  upsert: async (req: Request, res: Response) => {
    const result = await horoscopeService.upsertHoroscope(req.body);
    return successResponse(res, "Horoscope updated", result);
  },
};

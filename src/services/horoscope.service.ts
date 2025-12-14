import prisma from "@/config/prisma";
import { z } from "zod";
import { logger } from "@/utils/logger";

const horoscopeSchema = z.object({
  sign: z.enum([
    "Aries",
    "Taurus",
    "Gemini",
    "Cancer",
    "Leo",
    "Virgo",
    "Libra",
    "Scorpio",
    "Sagittarius",
    "Capricorn",
    "Aquarius",
    "Pisces",
  ]),
  content: z.string().min(10),
  type: z.enum(["DAILY", "WEEKLY"]),
  date: z.string().datetime().or(z.date()).or(z.string()), // flexible input
});

const HOROSCOPE_SIGNS = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
] as const;

export class HoroscopeService {
  /**
   * Get Horoscope for a sign
   */
  async getHoroscope(sign: string, type: "DAILY" | "WEEKLY" = "DAILY") {
    // For daily, we want today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const horoscope = await prisma.horoscope.findFirst({
      where: {
        sign,
        type,
        date: today,
      },
    });

    if (!horoscope) {
      // Fallback: return latest if today's not found (or mock)
      return {
        sign,
        type,
        date: today,
        content: "No prediction available for today yet.",
        isMock: true,
      };
    }

    return horoscope;
  }

  /**
   * Get all signs for today
   */
  async getDailyHoroscope() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return await prisma.horoscope.findMany({
      where: {
        type: "DAILY",
        date: today,
      },
    });
  }

  /**
   * Create/Update Horoscope (Admin)
   */
  async upsertHoroscope(data: any) {
    const validated = horoscopeSchema.parse({
      ...data,
      date: new Date(data.date || new Date().setHours(0, 0, 0, 0)),
    });

    // Ensure date is at midnight
    const date = new Date(validated.date);
    date.setHours(0, 0, 0, 0);

    return await prisma.horoscope.upsert({
      where: {
        sign_date_type: {
          sign: validated.sign,
          date: date,
          type: validated.type as any,
        },
      },
      update: {
        content: validated.content,
      },
      create: {
        sign: validated.sign,
        date: date,
        type: validated.type as any,
        content: validated.content,
      },
    });
  }

  /**
   * Ingest daily horoscope for all signs
   * This method can be called by cron job or manually
   * For now, it creates placeholder entries that can be filled by admin
   * In the future, this can integrate with a horoscope API
   */
  async ingestDailyHoroscope(): Promise<{ success: number; failed: number }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let success = 0;
    let failed = 0;

    logger.info(`Starting daily horoscope ingestion for ${HOROSCOPE_SIGNS.length} signs`);

    for (const sign of HOROSCOPE_SIGNS) {
      try {
        // Check if today's horoscope already exists
        const existing = await prisma.horoscope.findFirst({
          where: {
            sign,
            type: "DAILY",
            date: today,
          },
        });

        if (existing) {
          logger.debug(`Daily horoscope for ${sign} already exists, skipping`);
          success++;
          continue;
        }

        // Create placeholder entry
        // In production, this would fetch from an API or trigger admin notification
        await prisma.horoscope.create({
          data: {
            sign,
            date: today,
            type: "DAILY",
            content: `Daily horoscope for ${sign} - Please update this content. This is a placeholder entry created automatically.`,
          },
        });

        logger.debug(`Created placeholder daily horoscope for ${sign}`);
        success++;
      } catch (error) {
        logger.error(`Failed to ingest daily horoscope for ${sign}:`, error);
        failed++;
      }
    }

    logger.info(`Daily horoscope ingestion completed: ${success} success, ${failed} failed`);
    return { success, failed };
  }

  /**
   * Ingest weekly horoscope for all signs
   * Similar to daily, but for weekly predictions
   */
  async ingestWeeklyHoroscope(): Promise<{ success: number; failed: number }> {
    // Get the start of the current week (Monday)
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday
    const weekStart = new Date(today.setDate(diff));
    weekStart.setHours(0, 0, 0, 0);

    let success = 0;
    let failed = 0;

    logger.info(`Starting weekly horoscope ingestion for ${HOROSCOPE_SIGNS.length} signs`);

    for (const sign of HOROSCOPE_SIGNS) {
      try {
        // Check if this week's horoscope already exists
        const existing = await prisma.horoscope.findFirst({
          where: {
            sign,
            type: "WEEKLY",
            date: weekStart,
          },
        });

        if (existing) {
          logger.debug(`Weekly horoscope for ${sign} already exists, skipping`);
          success++;
          continue;
        }

        // Create placeholder entry
        await prisma.horoscope.create({
          data: {
            sign,
            date: weekStart,
            type: "WEEKLY",
            content: `Weekly horoscope for ${sign} - Please update this content. This is a placeholder entry created automatically.`,
          },
        });

        logger.debug(`Created placeholder weekly horoscope for ${sign}`);
        success++;
      } catch (error) {
        logger.error(`Failed to ingest weekly horoscope for ${sign}:`, error);
        failed++;
      }
    }

    logger.info(`Weekly horoscope ingestion completed: ${success} success, ${failed} failed`);
    return { success, failed };
  }

  /**
   * Batch ingest horoscopes for multiple signs
   * Used by cron jobs or admin tools
   */
  async batchIngestHoroscopes(
    signs: string[],
    type: "DAILY" | "WEEKLY"
  ): Promise<{ success: number; failed: number }> {
    const date = new Date();
    if (type === "DAILY") {
      date.setHours(0, 0, 0, 0);
    } else {
      // Weekly: get Monday of current week
      const dayOfWeek = date.getDay();
      const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      date.setDate(diff);
      date.setHours(0, 0, 0, 0);
    }

    let success = 0;
    let failed = 0;

    for (const sign of signs) {
      try {
        await this.upsertHoroscope({
          sign,
          type,
          date,
          content: `${type} horoscope for ${sign} - Please update this content.`,
        });
        success++;
      } catch (error) {
        logger.error(`Failed to ingest ${type.toLowerCase()} horoscope for ${sign}:`, error);
        failed++;
      }
    }

    return { success, failed };
  }
}

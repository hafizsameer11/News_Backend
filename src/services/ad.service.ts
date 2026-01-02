import prisma from "@/config/prisma";
import env from "@/config/env";
import Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { ROLE } from "@/types/enums";
import { calculateAdPrice, MIN_AD_DURATION_DAYS, MAX_AD_DURATION_DAYS } from "@/config/ad-pricing";
import { emailService } from "./email.service";
import { logger } from "@/utils/logger";
import { ga4Client } from "@/lib/ga4-client";

// Initialize Stripe (lazy initialization to handle missing key)
let stripeInstance: Stripe | null = null;

const getStripe = () => {
  if (!stripeInstance) {
    // Check both env object and process.env directly (in case .env wasn't loaded properly)
    const stripeKey = env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;

    if (!stripeKey || stripeKey === "sk_test_placeholder" || stripeKey.trim() === "") {
      console.error("❌ STRIPE_SECRET_KEY is not set or is placeholder");
      console.error(
        "   Current value from env:",
        env.STRIPE_SECRET_KEY ? `${env.STRIPE_SECRET_KEY.substring(0, 10)}...` : "undefined"
      );
      console.error(
        "   Current value from process.env:",
        process.env.STRIPE_SECRET_KEY
          ? `${process.env.STRIPE_SECRET_KEY.substring(0, 10)}...`
          : "undefined"
      );
      throw new Error(
        "Stripe secret key not configured. Please set STRIPE_SECRET_KEY in .env file"
      );
    }

    // Validate key format
    const trimmedKey = stripeKey.trim();
    if (!trimmedKey.startsWith("sk_test_") && !trimmedKey.startsWith("sk_live_")) {
      throw new Error("Invalid Stripe secret key format. Must start with 'sk_test_' or 'sk_live_'");
    }

    stripeInstance = new Stripe(trimmedKey, {
      apiVersion: "2024-09-30.acacia" as any,
    });
  }
  return stripeInstance;
};

export class AdService {
  /**
   * Get Ads (Public/Advertiser/Admin)
   * Supports slot-based retrieval with weighted random rotation
   */
  async getAds(query: any, userId?: string, role?: ROLE) {
    const { page = 1, limit = 10, status, type, slot } = query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};

    // Filter logic
    if (status) where.status = status;
    if (type) where.type = type;

    // Slot-based filtering (for public ad retrieval)
    if (slot) {
      // Map slot to ad type (for ads with position: null)
      // This allows backward compatibility with ads that only have type set
      const slotToTypeMap: Record<string, string[]> = {
        HEADER: ["BANNER_TOP"],
        TOP_BANNER: ["BANNER_TOP", "SLIDER_TOP"], // TOP_BANNER can be either banner or slider top
        SIDEBAR: ["BANNER_SIDE"],
        INLINE: ["INLINE"],
        FOOTER: ["FOOTER"],
        MID_PAGE: ["INLINE", "BANNER_TOP"],
        BETWEEN_SECTIONS: ["INLINE", "BANNER_TOP"],
        MOBILE: ["BANNER_SIDE", "BANNER_TOP", "INLINE"],
      };

      // Map slot to position values
      const slotToPositionMap: Record<string, string[]> = {
        HEADER: ["HEADER"],
        TOP_BANNER: ["TOP_BANNER", "HEADER"],
        SIDEBAR: ["SIDEBAR"],
        INLINE: ["INLINE", "INLINE_ARTICLE"],
        FOOTER: ["FOOTER"],
        MID_PAGE: ["MID_PAGE", "INLINE", "INLINE_ARTICLE"],
        BETWEEN_SECTIONS: ["BETWEEN_SECTIONS", "INLINE", "INLINE_ARTICLE"],
        MOBILE: ["MOBILE"],
      };

      const allowedTypes = slotToTypeMap[slot] || [];
      const allowedPositions = slotToPositionMap[slot] || [slot];

      where.status = "ACTIVE";
      const now = new Date();
      where.startDate = { lte: now };
      where.endDate = { gte: now };

      // Match by position OR by type (if position is null)
      // This supports both new ads with position set and legacy ads with only type
      where.OR = [
        // Match by position
        { position: { in: allowedPositions } },
        // Match by type when position is null (backward compatibility)
        ...(allowedTypes.length > 0
          ? [
              {
                AND: [
                  { type: { in: allowedTypes } },
                  { OR: [{ position: null }, { position: "" }] },
                ],
              },
            ]
          : []),
      ];
    }

    // Admin and Super Admin can see ALL ads (no advertiserId filter)
    const isAdmin = role === ROLE.ADMIN;
    const isSuperAdmin = role === ROLE.SUPER_ADMIN;

    if (isAdmin || isSuperAdmin) {
      // No advertiserId filter - show all ads
      logger.debug(`Admin/SuperAdmin (${role}) detected - showing all ads`);
    }
    // If Advertiser, only show their ads
    else if (role === ROLE.ADVERTISER) {
      where.advertiserId = userId;
      logger.debug(`Advertiser detected - filtering by userId: ${userId}`);
    }
    // If Public (no user), only show ACTIVE ads
    else if (!userId) {
      where.status = "ACTIVE";
      // Check dates
      const now = new Date();
      where.startDate = { lte: now };
      where.endDate = { gte: now };
      logger.debug("Public user - filtering active ads only");
    }

    let ads;
    let total;

    // If slot-based retrieval, use weighted random rotation
    if (slot && !userId) {
      // Get all matching ads for the slot
      const matchingAds = await prisma.ad.findMany({
        where,
        include: {
          advertiser: {
            select: {
              id: true,
              name: true,
              email: true,
              companyName: true,
            },
          },
        },
      });

      if (matchingAds.length === 0) {
        return {
          ads: [],
          meta: {
            total: 0,
            page: Number(page),
            limit: Number(limit),
            totalPages: 0,
          },
        };
      }

      // Weighted random selection based on impressions (ads with fewer impressions get higher weight)
      // This ensures fair rotation
      const weights = matchingAds.map((ad) => {
        // Higher weight for ads with fewer impressions (inverse relationship)
        return 1 / (1 + ad.impressions);
      });
      const totalWeight = weights.reduce((sum, w) => sum + w, 0);

      // Random selection
      let random = Math.random() * totalWeight;
      let selectedAd = matchingAds[0];

      for (let i = 0; i < matchingAds.length; i++) {
        random -= weights[i];
        if (random <= 0) {
          selectedAd = matchingAds[i];
          break;
        }
      }

      // For SLIDER and SLIDER_TOP types, return array; otherwise return single ad
      if (selectedAd.type === "SLIDER" || selectedAd.type === "SLIDER_TOP") {
        // Return multiple ads for slider (up to limit)
        ads = matchingAds.slice(0, Number(limit));
        total = matchingAds.length;
      } else {
        ads = [selectedAd];
        total = 1;
      }
    } else {
      // Standard pagination
      const [adsResult, totalResult] = await Promise.all([
        prisma.ad.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { createdAt: "desc" },
          include: {
            advertiser: {
              select: {
                id: true,
                name: true,
                email: true,
                companyName: true,
              },
            },
          },
        }),
        prisma.ad.count({ where }),
      ]);
      ads = adsResult;
      total = totalResult;
      logger.debug(`Ads query completed: ${ads.length} ads found, total: ${total}`);
    }

    return {
      ads,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    };
  }

  /**
   * Create Ad (Advertiser/Admin)
   */
  async createAd(data: any, userId: string, role?: ROLE) {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Reset time to start of day for comparison

    // Prevent past dates
    if (start < now) {
      throw new Error("Start date cannot be in the past");
    }

    // Business logic validation
    if (end <= start) {
      throw new Error("End date must be after start date");
    }

    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24));
    if (days < MIN_AD_DURATION_DAYS) {
      throw new Error(`Ad duration must be at least ${MIN_AD_DURATION_DAYS} day(s)`);
    }
    if (days > MAX_AD_DURATION_DAYS) {
      throw new Error(`Ad duration cannot exceed ${MAX_AD_DURATION_DAYS} days`);
    }

    // Check for booking conflicts (only if position is specified)
    // Slider ads can have multiple ads on same date, so we only check conflicts for fixed positions
    if (data.position) {
      const conflict = await this.checkBookingConflict(start, end, data.position);
      if (conflict.isConflict) {
        throw new Error(
          `This date and position are already booked by ad: "${conflict.conflictingAd?.title}". Please select a different date or position.`
        );
      }
    }

    // Validate URLs are accessible (basic check - just format validation is done in validator)
    // Additional validation can be added here if needed

    // Calculate price using configurable rates
    // Allow price override if provided (admin can set custom price)
    let priceValue: number;
    if (data.price !== undefined && data.price !== null && data.price !== "") {
      // Handle both string and number inputs
      if (typeof data.price === "string") {
        priceValue = parseFloat(data.price);
      } else if (typeof data.price === "number") {
        priceValue = data.price;
      } else {
        throw new Error("Price must be a valid number");
      }
    } else {
      priceValue = calculateAdPrice(data.type, start, end);
    }

    // Validate price is a valid number
    if (isNaN(priceValue) || priceValue < 0) {
      throw new Error("Price must be a valid positive number");
    }

    // Validate price doesn't exceed database limit (Decimal(10, 2) = 99,999,999.99)
    const MAX_PRICE = 99999999.99;
    if (priceValue > MAX_PRICE) {
      throw new Error(`Price cannot exceed ${MAX_PRICE.toLocaleString()}`);
    }

    // Round to 2 decimal places and convert to Decimal type
    const calculatedPrice = new Prisma.Decimal(Math.round(priceValue * 100) / 100);

    // Auto-activate ads created by admins
    const isAdmin = role === ROLE.ADMIN || role === ROLE.SUPER_ADMIN;
    const adStatus = isAdmin ? "ACTIVE" : "PENDING";

    return await prisma.ad.create({
      data: {
        ...data,
        price: calculatedPrice,
        advertiserId: userId,
        status: adStatus, // Active for admins, Pending for advertisers
        isPaid: isAdmin, // Mark as paid if created by admin
      },
    });
  }

  /**
   * Create Payment Intent (Stripe)
   */
  async createPaymentIntent(adId: string, userId: string) {
    const ad = await prisma.ad.findUnique({ where: { id: adId } });
    if (!ad) throw new Error("Ad not found");

    if (ad.advertiserId !== userId) throw new Error("Unauthorized");
    if (ad.isPaid) throw new Error("Ad is already paid");

    const stripe = getStripe();

    // Create Stripe Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(Number(ad.price) * 100), // Amount in cents
      currency: "eur",
      metadata: {
        adId: ad.id,
        userId: userId,
      },
    });

    return {
      clientSecret: paymentIntent.client_secret,
      amount: ad.price,
      currency: "eur",
    };
  }

  /**
   * Track Impression
   */
  async trackImpression(adId: string) {
    // Increment is atomic
    const ad = await prisma.ad.update({
      where: { id: adId },
      data: { impressions: { increment: 1 } },
    });

    // Send GA4 event asynchronously
    setImmediate(async () => {
      try {
        await ga4Client.trackAdImpression(adId, ad.title);
      } catch (error) {
        // Log error but don't break the request flow
        console.error("Failed to track GA4 ad impression:", error);
      }
    });
  }

  /**
   * Track Click
   */
  async trackClick(adId: string) {
    const ad = await prisma.ad.update({
      where: { id: adId },
      data: { clicks: { increment: 1 } },
    });

    // Send GA4 event asynchronously
    setImmediate(async () => {
      try {
        await ga4Client.trackAdClick(adId, ad.title);
      } catch (error) {
        // Log error but don't break the request flow
        console.error("Failed to track GA4 ad click:", error);
      }
    });
  }

  /**
   * Update Ad (Admin/Advertiser)
   */
  async updateAd(id: string, data: any, userId: string, role: ROLE) {
    const ad = await prisma.ad.findUnique({ where: { id } });
    if (!ad) throw new Error("Ad not found");

    if (role === ROLE.ADVERTISER && ad.advertiserId !== userId) {
      throw new Error("Unauthorized");
    }

    // Prepare update data with proper type conversions
    const updateData: any = { ...data };

    // Track if price was explicitly provided
    const priceWasProvided = updateData.price !== undefined;
    let processedPrice: Prisma.Decimal | undefined;

    // Handle price conversion - Decimal(10, 2) can store up to 99,999,999.99
    if (priceWasProvided) {
      // Convert to number if it's a string
      const priceValue = typeof updateData.price === "string" ? parseFloat(updateData.price) : updateData.price;
      
      // Validate price is a valid number
      if (isNaN(priceValue) || priceValue < 0) {
        throw new Error("Price must be a valid positive number");
      }

      // Validate price doesn't exceed database limit (Decimal(10, 2) = 99,999,999.99)
      const MAX_PRICE = 99999999.99;
      if (priceValue > MAX_PRICE) {
        throw new Error(`Price cannot exceed ${MAX_PRICE.toLocaleString()}`);
      }

      // Round to 2 decimal places and convert to Decimal type
      processedPrice = new Prisma.Decimal(Math.round(priceValue * 100) / 100);
    }

    // Handle date conversions if dates are being updated
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Reset time to start of day for comparison
    
    if (updateData.startDate) {
      updateData.startDate = new Date(updateData.startDate);
      // Prevent past dates
      if (updateData.startDate < now) {
        throw new Error("Start date cannot be in the past");
      }
    }

    if (updateData.endDate) {
      updateData.endDate = new Date(updateData.endDate);
    }

    // Validate date range if both dates are being updated
    if (updateData.startDate && updateData.endDate) {
      if (updateData.endDate <= updateData.startDate) {
        throw new Error("End date must be after start date");
      }
    }

    // Recalculate price if dates or type changed (only if price wasn't explicitly provided)
    if (!priceWasProvided && (updateData.startDate || updateData.endDate || updateData.type)) {
      const startDate = updateData.startDate ? new Date(updateData.startDate) : new Date(ad.startDate);
      const endDate = updateData.endDate ? new Date(updateData.endDate) : new Date(ad.endDate);
      const adType = updateData.type || ad.type;

      const calculatedPrice = calculateAdPrice(adType, startDate, endDate);
      processedPrice = new Prisma.Decimal(Math.round(calculatedPrice * 100) / 100);
    }

    // Check for booking conflicts if dates or position are being updated
    // Only check if position is specified (slider ads can have multiple on same date)
    const positionToCheck = updateData.position !== undefined ? updateData.position : ad.position;
    const startDateToCheck = updateData.startDate ? new Date(updateData.startDate) : new Date(ad.startDate);
    const endDateToCheck = updateData.endDate ? new Date(updateData.endDate) : new Date(ad.endDate);

    if (positionToCheck && (updateData.startDate || updateData.endDate || updateData.position !== undefined)) {
      const conflict = await this.checkBookingConflict(startDateToCheck, endDateToCheck, positionToCheck, id);
      if (conflict.isConflict) {
        throw new Error(
          `This date and position are already booked by ad: "${conflict.conflictingAd?.title}". Please select a different date or position.`
        );
      }
    }

    // Set the processed price if we have one
    if (processedPrice !== undefined) {
      updateData.price = processedPrice;
    }

    return await prisma.ad.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Approve Ad (Admin only)
   */
  async approveAd(adId: string) {
    const ad = await prisma.ad.findUnique({
      where: { id: adId },
      include: { advertiser: true },
    });
    if (!ad) throw new Error("Ad not found");

    if (ad.status !== "PENDING") {
      throw new Error("Only PENDING ads can be approved");
    }

    // Check if ad is paid - if not, keep as PENDING until payment
    if (!ad.isPaid) {
      throw new Error("Ad must be paid before approval");
    }

    const updatedAd = await prisma.ad.update({
      where: { id: adId },
      data: {
        status: "ACTIVE",
        rejectionReason: null, // Clear any previous rejection reason
      },
    });

    // Send approval email to advertiser (non-blocking)
    if (ad.advertiser && ad.advertiser.email) {
      try {
        await emailService.sendAdApprovalEmail(ad.advertiser.email, {
          id: ad.id,
          title: ad.title,
          type: ad.type,
          startDate: ad.startDate,
          endDate: ad.endDate,
        });
      } catch (error) {
        // Log error but don't fail the approval
        logger.error("Failed to send ad approval email:", error);
      }
    }

    return updatedAd;
  }

  /**
   * Reject Ad (Admin only)
   */
  async rejectAd(adId: string, reason: string) {
    const ad = await prisma.ad.findUnique({
      where: { id: adId },
      include: { advertiser: true },
    });
    if (!ad) throw new Error("Ad not found");

    if (ad.status !== "PENDING") {
      throw new Error("Only PENDING ads can be rejected");
    }

    const updatedAd = await prisma.ad.update({
      where: { id: adId },
      data: {
        status: "REJECTED",
        rejectionReason: reason,
      },
    });

    // Send rejection email to advertiser (non-blocking)
    if (ad.advertiser && ad.advertiser.email) {
      try {
        await emailService.sendAdRejectionEmail(
          ad.advertiser.email,
          {
            id: ad.id,
            title: ad.title,
          },
          reason
        );
      } catch (error) {
        // Log error but don't fail the rejection
        logger.error("Failed to send ad rejection email:", error);
      }
    }

    return updatedAd;
  }

  /**
   * Delete Ad (Advertiser/Admin)
   */
  async deleteAd(adId: string, userId: string, role: ROLE) {
    const ad = await prisma.ad.findUnique({
      where: { id: adId },
      include: { transactions: true },
    });
    if (!ad) throw new Error("Ad not found");

    // Check authorization
    if (role === ROLE.ADVERTISER && ad.advertiserId !== userId) {
      throw new Error("Unauthorized");
    }

    // Check if ad has active transactions
    const hasActiveTransactions = ad.transactions.some(
      (t) => t.status === "PENDING" || t.status === "SUCCEEDED"
    );
    if (hasActiveTransactions) {
      throw new Error("Cannot delete ad with active transactions");
    }

    return await prisma.ad.delete({
      where: { id: adId },
    });
  }

  /**
   * Pause Ad (Advertiser/Admin)
   */
  async pauseAd(adId: string, userId: string, role: ROLE) {
    const ad = await prisma.ad.findUnique({ where: { id: adId } });
    if (!ad) throw new Error("Ad not found");

    // Check authorization
    if (role === ROLE.ADVERTISER && ad.advertiserId !== userId) {
      throw new Error("Unauthorized");
    }

    if (ad.status !== "ACTIVE") {
      throw new Error("Only ACTIVE ads can be paused");
    }

    return await prisma.ad.update({
      where: { id: adId },
      data: { status: "PAUSED" },
    });
  }

  /**
   * Resume Ad (Advertiser/Admin)
   */
  async resumeAd(adId: string, userId: string, role: ROLE) {
    const ad = await prisma.ad.findUnique({ where: { id: adId } });
    if (!ad) throw new Error("Ad not found");

    // Check authorization
    if (role === ROLE.ADVERTISER && ad.advertiserId !== userId) {
      throw new Error("Unauthorized");
    }

    if (ad.status !== "PAUSED") {
      throw new Error("Only PAUSED ads can be resumed");
    }

    // Check if ad is still within date range
    const now = new Date();
    if (ad.endDate < now) {
      throw new Error("Cannot resume expired ad");
    }

    if (ad.startDate > now) {
      // Ad hasn't started yet, keep as PENDING or ACTIVE based on payment
      return await prisma.ad.update({
        where: { id: adId },
        data: { status: ad.isPaid ? "ACTIVE" : "PENDING" },
      });
    }

    return await prisma.ad.update({
      where: { id: adId },
      data: { status: "ACTIVE" },
    });
  }

  /**
   * Get Ad Analytics (Single Ad)
   */
  async getAdAnalytics(adId: string, userId?: string, role?: ROLE) {
    const ad = await prisma.ad.findUnique({ where: { id: adId } });
    if (!ad) throw new Error("Ad not found");

    // Check authorization
    if (role === ROLE.ADVERTISER && ad.advertiserId !== userId) {
      throw new Error("Unauthorized");
    }

    const ctr = ad.impressions > 0 ? (ad.clicks / ad.impressions) * 100 : 0;

    return {
      adId: ad.id,
      title: ad.title,
      impressions: ad.impressions,
      clicks: ad.clicks,
      ctr: parseFloat(ctr.toFixed(2)),
      status: ad.status,
      startDate: ad.startDate,
      endDate: ad.endDate,
      createdAt: ad.createdAt,
    };
  }

  /**
   * Get Advertiser Analytics (All Ads)
   */
  async getAdvertiserAnalytics(userId: string) {
    const ads = await prisma.ad.findMany({
      where: { advertiserId: userId },
      select: {
        id: true,
        title: true,
        impressions: true,
        clicks: true,
        status: true,
        startDate: true,
        endDate: true,
        createdAt: true,
      },
    });

    const totalImpressions = ads.reduce((sum, ad) => sum + ad.impressions, 0);
    const totalClicks = ads.reduce((sum, ad) => sum + ad.clicks, 0);
    const averageCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

    return {
      totalAds: ads.length,
      totalImpressions,
      totalClicks,
      averageCTR: parseFloat(averageCTR.toFixed(2)),
      ads: ads.map((ad) => {
        const ctr = ad.impressions > 0 ? (ad.clicks / ad.impressions) * 100 : 0;
        return {
          ...ad,
          ctr: parseFloat(ctr.toFixed(2)),
        };
      }),
    };
  }

  /**
   * Stripe Webhook Handler (simplified)
   */
  async handleStripeWebhook(event: Stripe.Event) {
    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const adId = paymentIntent.metadata.adId;

      if (adId) {
        await prisma.ad.update({
          where: { id: adId },
          data: {
            isPaid: true,
            status: "ACTIVE", // Auto-activate on payment
          },
        });
        console.log(`Ad ${adId} marked as paid.`);
      }
    }
  }

  /**
   * Get calendar data - booked dates with positions
   * Returns dates that have active ads booked
   */
  async getCalendar(year?: number, month?: number) {
    const now = new Date();
    const startYear = year || now.getFullYear();
    const startMonth = month !== undefined ? month : now.getMonth();

    // Calculate date range for the requested month (start of first day to end of last day)
    const startDate = new Date(startYear, startMonth, 1, 0, 0, 0, 0);
    const endDate = new Date(startYear, startMonth + 1, 0, 23, 59, 59, 999);

    logger.debug(`Fetching calendar for ${startYear}-${startMonth + 1}, date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // Get all active ads that overlap with the requested month
    // An ad overlaps if: ad.startDate <= monthEndDate AND ad.endDate >= monthStartDate
    const bookedAds = await prisma.ad.findMany({
      where: {
        status: {
          in: ["ACTIVE", "PENDING"], // Only count active or pending ads
        },
        // Simplified overlap check: ad overlaps if it starts before month ends AND ends after month starts
        AND: [
          {
            startDate: {
              lte: endDate,
            },
          },
          {
            endDate: {
              gte: startDate,
            },
          },
        ],
      },
      select: {
        id: true,
        title: true,
        startDate: true,
        endDate: true,
        position: true,
        type: true,
        status: true,
      },
    });

    logger.debug(`Found ${bookedAds.length} ads that overlap with the requested month`);

    // Group by date and position
    const calendarData: Record<string, Array<{
      position: string | null;
      type: string;
      title: string;
      id: string;
      status: string;
    }>> = {};

    bookedAds.forEach((ad) => {
      const start = new Date(ad.startDate);
      const end = new Date(ad.endDate);
      
      // Normalize dates to start of day (midnight) to avoid timezone issues
      const startNormalized = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const endNormalized = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      const startDateNormalized = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
      const endDateNormalized = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
      
      // Clamp the iteration range to the requested month
      const iterationStart = startNormalized > startDateNormalized ? startNormalized : startDateNormalized;
      const iterationEnd = endNormalized < endDateNormalized ? endNormalized : endDateNormalized;
      
      // Iterate through each day in the ad's date range (within the requested month)
      const currentDate = new Date(iterationStart);
      while (currentDate <= iterationEnd) {
        // Format date key as YYYY-MM-DD (local date, not UTC)
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, "0");
        const day = String(currentDate.getDate()).padStart(2, "0");
        const dateKey = `${year}-${month}-${day}`;
        
        if (!calendarData[dateKey]) {
          calendarData[dateKey] = [];
        }
        
        calendarData[dateKey].push({
          position: ad.position || null,
          type: ad.type,
          title: ad.title,
          id: ad.id,
          status: ad.status,
        });
        
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }
    });

    // Log for debugging
    logger.debug(`Calendar data for ${startYear}-${startMonth + 1}: ${bookedAds.length} ads found, ${Object.keys(calendarData).length} days with bookings`);

    return calendarData;
  }

  /**
   * Check if a date + position combination is already booked
   */
  async checkBookingConflict(
    startDate: Date,
    endDate: Date,
    position: string | null,
    excludeAdId?: string
  ): Promise<{ isConflict: boolean; conflictingAd?: { id: string; title: string } }> {
    const whereClause: any = {
      status: {
        in: ["ACTIVE", "PENDING"], // Only check active or pending ads
      },
      OR: [
        // New ad starts during existing ad
        {
          startDate: { lte: startDate },
          endDate: { gte: startDate },
        },
        // New ad ends during existing ad
        {
          startDate: { lte: endDate },
          endDate: { gte: endDate },
        },
        // New ad completely contains existing ad
        {
          startDate: { gte: startDate },
          endDate: { lte: endDate },
        },
        // Existing ad completely contains new ad
        {
          startDate: { lte: startDate },
          endDate: { gte: endDate },
        },
      ],
    };

    // If position is specified, check for same position conflicts
    // If position is null/empty, check for any position (for slider/rotating ads)
    if (position) {
      whereClause.position = position;
    }

    // Exclude current ad if updating
    if (excludeAdId) {
      whereClause.id = { not: excludeAdId };
    }

    const conflictingAd = await prisma.ad.findFirst({
      where: whereClause,
      select: {
        id: true,
        title: true,
        startDate: true,
        endDate: true,
        position: true,
      },
    });

    if (conflictingAd) {
      return {
        isConflict: true,
        conflictingAd: {
          id: conflictingAd.id,
          title: conflictingAd.title,
        },
      };
    }

    return { isConflict: false };
  }
}

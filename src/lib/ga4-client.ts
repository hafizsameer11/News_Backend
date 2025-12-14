import env from "@/config/env";
import { logger } from "@/utils/logger";

/**
 * Google Analytics 4 Measurement Protocol Client
 * Sends server-side events to GA4
 */
export class GA4Client {
  private measurementId: string;
  private apiSecret: string;
  private enabled: boolean;
  private baseUrl = "https://www.google-analytics.com/mp/collect";

  constructor() {
    this.measurementId = env.GA4_MEASUREMENT_ID;
    this.apiSecret = env.GA4_API_SECRET;
    this.enabled = env.GA4_ENABLED && !!this.measurementId && !!this.apiSecret;

    if (this.enabled) {
      logger.info("GA4 client initialized");
    } else {
      logger.warn("GA4 client disabled - missing configuration");
    }
  }

  /**
   * Send event to GA4
   */
  async sendEvent(
    eventName: string,
    params?: {
      clientId?: string;
      userId?: string;
      [key: string]: any;
    }
  ): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      const payload = {
        client_id: params?.clientId || this.generateClientId(),
        user_id: params?.userId,
        events: [
          {
            name: eventName,
            params: {
              ...params,
              clientId: undefined, // Remove clientId from params
              userId: undefined, // Remove userId from params (it's at root level)
            },
          },
        ],
      };

      const url = `${this.baseUrl}?measurement_id=${this.measurementId}&api_secret=${this.apiSecret}`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        logger.error(`GA4 event failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      // Log error but don't break the main flow
      logger.error("Failed to send GA4 event:", error);
    }
  }

  /**
   * Track page view
   */
  async trackPageView(
    pagePath: string,
    pageTitle?: string,
    options?: {
      clientId?: string;
      userId?: string;
    }
  ): Promise<void> {
    return this.sendEvent("page_view", {
      page_path: pagePath,
      page_title: pageTitle,
      ...options,
    });
  }

  /**
   * Track custom event
   */
  async trackEvent(
    eventName: string,
    eventParams?: {
      [key: string]: any;
      clientId?: string;
      userId?: string;
    }
  ): Promise<void> {
    return this.sendEvent(eventName, eventParams);
  }

  /**
   * Track user sign up
   */
  async trackSignUp(
    userId: string,
    method?: string,
    options?: { clientId?: string }
  ): Promise<void> {
    return this.sendEvent("sign_up", {
      method: method || "email",
      userId,
      ...options,
    });
  }

  /**
   * Track ad click
   */
  async trackAdClick(
    adId: string,
    adTitle?: string,
    options?: {
      clientId?: string;
      userId?: string;
    }
  ): Promise<void> {
    return this.sendEvent("ad_click", {
      ad_id: adId,
      ad_title: adTitle,
      ...options,
    });
  }

  /**
   * Track ad impression
   */
  async trackAdImpression(
    adId: string,
    adTitle?: string,
    options?: {
      clientId?: string;
      userId?: string;
    }
  ): Promise<void> {
    return this.sendEvent("ad_impression", {
      ad_id: adId,
      ad_title: adTitle,
      ...options,
    });
  }

  /**
   * Track newsletter subscription
   */
  async trackNewsletterSubscribe(
    email: string,
    options?: {
      clientId?: string;
      userId?: string;
    }
  ): Promise<void> {
    return this.sendEvent("newsletter_subscribe", {
      email,
      ...options,
    });
  }

  /**
   * Generate a client ID (for anonymous users)
   */
  private generateClientId(): string {
    // Generate a simple client ID (in production, you might want to use a more sophisticated approach)
    return `server.${Date.now()}.${Math.random().toString(36).substring(2, 15)}`;
  }
}

// Export singleton instance
export const ga4Client = new GA4Client();

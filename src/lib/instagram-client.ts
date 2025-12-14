import axios, { AxiosError } from "axios";
import env from "@/config/env";
import { logger } from "@/utils/logger";
import crypto from "crypto";
import { SocialAPIError, RateLimitError, TokenExpiredError } from "@/types/social-errors";

export interface TokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
}

export interface IGAccount {
  id: string;
  username: string;
  account_type: string;
}

export interface PostContent {
  message?: string;
  link?: string;
  image_url?: string;
  caption?: string;
}

export interface MediaContent {
  image_url: string;
  caption?: string;
  location_id?: string;
  user_tags?: any[];
}

export interface ContainerResponse {
  id: string;
}

export interface PostResponse {
  id: string;
  permalink?: string;
}

export class InstagramClient {
  private readonly appId: string;
  private readonly appSecret: string;
  private readonly redirectUri: string;
  private readonly baseUrl = "https://graph.facebook.com/v18.0";

  constructor() {
    this.appId = env.INSTAGRAM_APP_ID || env.FACEBOOK_APP_ID; // Can use same as Facebook
    this.appSecret = env.INSTAGRAM_APP_SECRET || env.FACEBOOK_APP_SECRET;
    this.redirectUri = env.INSTAGRAM_REDIRECT_URI;
  }

  /**
   * Generate OAuth authorization URL
   * Note: Instagram uses Facebook OAuth
   */
  getOAuthUrl(state: string): string {
    const scopes = [
      "instagram_basic",
      "instagram_content_publish",
      "pages_show_list",
      "pages_read_engagement",
    ].join(",");

    const params = new URLSearchParams({
      client_id: this.appId,
      redirect_uri: this.redirectUri,
      state,
      scope: scopes,
      response_type: "code",
    });

    return `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`;
  }

  /**
   * Exchange OAuth code for access token
   */
  async exchangeCodeForToken(code: string): Promise<TokenResponse> {
    try {
      const response = await axios.get(`${this.baseUrl}/oauth/access_token`, {
        params: {
          client_id: this.appId,
          client_secret: this.appSecret,
          redirect_uri: this.redirectUri,
          code,
        },
      });

      return {
        access_token: response.data.access_token,
        token_type: response.data.token_type,
        expires_in: response.data.expires_in,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<any>;
        logger.error("Instagram token exchange error:", axiosError.response?.data);
        throw new SocialAPIError(
          `Failed to exchange code for token: ${axiosError.response?.data?.error?.message || axiosError.message}`,
          "INSTAGRAM",
          axiosError.response?.status,
          axiosError.response?.data
        );
      }
      throw error;
    }
  }

  /**
   * Convert short-lived token to long-lived token (60 days)
   */
  async getLongLivedToken(shortLivedToken: string): Promise<string> {
    try {
      const response = await axios.get(`${this.baseUrl}/oauth/access_token`, {
        params: {
          grant_type: "fb_exchange_token",
          client_id: this.appId,
          client_secret: this.appSecret,
          fb_exchange_token: shortLivedToken,
        },
      });

      return response.data.access_token;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<any>;
        logger.error("Instagram long-lived token error:", axiosError.response?.data);
        throw new Error(
          `Failed to get long-lived token: ${axiosError.response?.data?.error?.message || axiosError.message}`
        );
      }
      throw error;
    }
  }

  /**
   * Refresh long-lived token
   */
  async refreshToken(accessToken: string): Promise<TokenResponse> {
    try {
      const response = await axios.get(`${this.baseUrl}/oauth/access_token`, {
        params: {
          grant_type: "fb_exchange_token",
          client_id: this.appId,
          client_secret: this.appSecret,
          fb_exchange_token: accessToken,
        },
      });

      return {
        access_token: response.data.access_token,
        expires_in: response.data.expires_in,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.warn("Instagram token refresh attempt failed, using original token");
        return {
          access_token: accessToken,
        };
      }
      throw error;
    }
  }

  /**
   * Get Instagram Business account connected to a Facebook page
   */
  async getInstagramBusinessAccount(userId: string, accessToken: string): Promise<IGAccount> {
    try {
      // First, get user's pages
      const pagesResponse = await axios.get(`${this.baseUrl}/${userId}/accounts`, {
        params: {
          access_token: accessToken,
          fields: "instagram_business_account",
        },
      });

      const pages = pagesResponse.data.data;
      if (!pages || pages.length === 0) {
        throw new Error("No Facebook pages found. Please connect a Facebook page first.");
      }

      // Find page with Instagram Business account
      for (const page of pages) {
        if (page.instagram_business_account) {
          const igAccountResponse = await axios.get(
            `${this.baseUrl}/${page.instagram_business_account.id}`,
            {
              params: {
                access_token: accessToken,
                fields: "id,username,account_type",
              },
            }
          );

          return {
            id: igAccountResponse.data.id,
            username: igAccountResponse.data.username,
            account_type: igAccountResponse.data.account_type,
          };
        }
      }

      throw new Error(
        "No Instagram Business account found. Please connect an Instagram Business account to your Facebook page."
      );
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<any>;
        logger.error("Instagram get business account error:", axiosError.response?.data);
        throw new Error(
          `Failed to get Instagram Business account: ${axiosError.response?.data?.error?.message || axiosError.message}`
        );
      }
      throw error;
    }
  }

  /**
   * Create media container for Instagram post
   */
  async createMediaContainer(
    accountId: string,
    accessToken: string,
    content: MediaContent
  ): Promise<ContainerResponse> {
    try {
      const params: any = {
        access_token: accessToken,
        image_url: content.image_url,
      };

      if (content.caption) {
        params.caption = content.caption;
      }

      if (content.location_id) {
        params.location_id = content.location_id;
      }

      if (content.user_tags) {
        params.user_tags = JSON.stringify(content.user_tags);
      }

      const response = await axios.post(`${this.baseUrl}/${accountId}/media`, null, {
        params,
      });

      return {
        id: response.data.id,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<any>;
        logger.error("Instagram create media container error:", axiosError.response?.data);

        if (axiosError.response?.status === 429) {
          const retryAfter = axiosError.response?.headers["retry-after"];
          throw new RateLimitError(
            "Rate limit exceeded. Please try again later.",
            retryAfter ? parseInt(retryAfter) : undefined
          );
        }

        if (axiosError.response?.status === 401) {
          throw new TokenExpiredError("Instagram access token has expired", "INSTAGRAM");
        }

        throw new SocialAPIError(
          `Failed to create media container: ${axiosError.response?.data?.error?.message || axiosError.message}`,
          "INSTAGRAM",
          axiosError.response?.status,
          axiosError.response?.data
        );
      }
      throw error;
    }
  }

  /**
   * Publish media container to Instagram
   */
  async publishMediaContainer(
    accountId: string,
    accessToken: string,
    containerId: string
  ): Promise<PostResponse> {
    try {
      // Check container status first
      let status = "IN_PROGRESS";
      let attempts = 0;
      const maxAttempts = 30; // Wait up to 5 minutes (30 * 10 seconds)

      while (status === "IN_PROGRESS" && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait 10 seconds

        const statusResponse = await axios.get(`${this.baseUrl}/${containerId}`, {
          params: {
            access_token: accessToken,
            fields: "status_code",
          },
        });

        status = statusResponse.data.status_code;
        attempts++;

        if (status === "ERROR") {
          throw new Error("Media container processing failed");
        }
      }

      if (status !== "FINISHED") {
        throw new Error("Media container processing timeout");
      }

      // Publish the container
      const response = await axios.post(`${this.baseUrl}/${accountId}/media_publish`, null, {
        params: {
          access_token: accessToken,
          creation_id: containerId,
        },
      });

      // Get post details
      const postResponse = await axios.get(`${this.baseUrl}/${response.data.id}`, {
        params: {
          access_token: accessToken,
          fields: "id,permalink",
        },
      });

      return {
        id: postResponse.data.id,
        permalink: postResponse.data.permalink,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<any>;
        logger.error("Instagram publish media error:", axiosError.response?.data);

        if (axiosError.response?.status === 429) {
          const retryAfter = axiosError.response?.headers["retry-after"];
          throw new RateLimitError(
            "Rate limit exceeded. Please try again later.",
            retryAfter ? parseInt(retryAfter) : undefined
          );
        }

        if (axiosError.response?.status === 401) {
          throw new TokenExpiredError("Instagram access token has expired", "INSTAGRAM");
        }

        throw new SocialAPIError(
          `Failed to publish to Instagram: ${axiosError.response?.data?.error?.message || axiosError.message}`,
          "INSTAGRAM",
          axiosError.response?.status,
          axiosError.response?.data
        );
      }
      throw error;
    }
  }

  /**
   * Post to Instagram (simplified - creates container and publishes)
   */
  async postToInstagram(
    accountId: string,
    accessToken: string,
    content: PostContent
  ): Promise<PostResponse> {
    if (!content.image_url) {
      throw new Error("Image URL is required for Instagram posts");
    }

    // Create media container
    const container = await this.createMediaContainer(accountId, accessToken, {
      image_url: content.image_url,
      caption: content.caption || content.message,
    });

    // Publish container
    return await this.publishMediaContainer(accountId, accessToken, container.id);
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    try {
      const expectedSignature = crypto
        .createHmac("sha256", this.appSecret)
        .update(payload)
        .digest("hex");

      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    } catch (error) {
      logger.error("Webhook signature verification error:", error);
      return false;
    }
  }

  /**
   * Validate access token
   */
  async validateToken(accessToken: string): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/me`, {
        params: {
          access_token: accessToken,
        },
      });

      return !!response.data.id;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<any>;
        if (axiosError.response?.status === 401) {
          return false; // Token is invalid or expired
        }
      }
      return false;
    }
  }
}

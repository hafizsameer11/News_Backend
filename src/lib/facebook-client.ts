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

export interface PageInfo {
  id: string;
  name: string;
  access_token: string;
}

export interface Page {
  id: string;
  name: string;
  access_token: string;
}

export interface PostContent {
  message?: string;
  link?: string;
  picture?: string;
}

export interface PostResponse {
  id: string;
  post_id?: string;
}

export class FacebookClient {
  private readonly appId: string;
  private readonly appSecret: string;
  private readonly redirectUri: string;
  private readonly baseUrl = "https://graph.facebook.com/v18.0";

  constructor() {
    this.appId = env.FACEBOOK_APP_ID;
    this.appSecret = env.FACEBOOK_APP_SECRET;
    this.redirectUri = env.FACEBOOK_REDIRECT_URI;
  }

  /**
   * Generate OAuth authorization URL
   */
  getOAuthUrl(state: string): string {
    const scopes = [
      "pages_manage_posts",
      "pages_read_engagement",
      "pages_show_list",
      "instagram_basic",
      "instagram_content_publish",
      "pages_read_user_content",
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
        logger.error("Facebook token exchange error:", axiosError.response?.data);
        throw new SocialAPIError(
          `Failed to exchange code for token: ${axiosError.response?.data?.error?.message || axiosError.message}`,
          "FACEBOOK",
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
        logger.error("Facebook long-lived token error:", axiosError.response?.data);
        throw new Error(
          `Failed to get long-lived token: ${axiosError.response?.data?.error?.message || axiosError.message}`
        );
      }
      throw error;
    }
  }

  /**
   * Refresh long-lived token (if refresh token is available)
   * Note: Facebook long-lived tokens can be refreshed by exchanging them again
   */
  async refreshToken(accessToken: string): Promise<TokenResponse> {
    // Facebook doesn't provide refresh tokens in the traditional sense
    // Long-lived tokens (60 days) can be extended by re-exchanging
    // For now, we'll return the same token and let the caller handle expiry
    try {
      // Try to extend the token
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
        // If token is already long-lived, this might fail
        // Return the original token
        logger.warn("Facebook token refresh attempt failed, using original token");
        return {
          access_token: accessToken,
        };
      }
      throw error;
    }
  }

  /**
   * Get user's Facebook pages
   */
  async getUserPages(accessToken: string): Promise<Page[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/me/accounts`, {
        params: {
          access_token: accessToken,
          fields: "id,name,access_token",
        },
      });

      return response.data.data.map((page: any) => ({
        id: page.id,
        name: page.name,
        access_token: page.access_token,
      }));
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<any>;
        logger.error("Facebook get pages error:", axiosError.response?.data);
        throw new Error(
          `Failed to get user pages: ${axiosError.response?.data?.error?.message || axiosError.message}`
        );
      }
      throw error;
    }
  }

  /**
   * Get Facebook page details
   */
  async getPageInfo(pageId: string, accessToken: string): Promise<PageInfo> {
    try {
      const response = await axios.get(`${this.baseUrl}/${pageId}`, {
        params: {
          access_token: accessToken,
          fields: "id,name,access_token",
        },
      });

      return {
        id: response.data.id,
        name: response.data.name,
        access_token: accessToken,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<any>;
        logger.error("Facebook get page info error:", axiosError.response?.data);
        throw new Error(
          `Failed to get page info: ${axiosError.response?.data?.error?.message || axiosError.message}`
        );
      }
      throw error;
    }
  }

  /**
   * Post to Facebook page
   */
  async postToPage(
    pageId: string,
    accessToken: string,
    content: PostContent
  ): Promise<PostResponse> {
    try {
      const params: any = {
        access_token: accessToken,
      };

      if (content.link) {
        params.link = content.link;
      }

      if (content.message) {
        params.message = content.message;
      }

      if (content.picture) {
        params.picture = content.picture;
      }

      const response = await axios.post(`${this.baseUrl}/${pageId}/feed`, null, {
        params,
      });

      return {
        id: response.data.id,
        post_id: response.data.id,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<any>;
        logger.error("Facebook post error:", axiosError.response?.data);

        // Handle rate limiting
        if (axiosError.response?.status === 429) {
          const retryAfter = axiosError.response?.headers["retry-after"];
          throw new RateLimitError(
            "Rate limit exceeded. Please try again later.",
            retryAfter ? parseInt(retryAfter) : undefined
          );
        }

        // Handle token expiration
        if (axiosError.response?.status === 401) {
          throw new TokenExpiredError("Facebook access token has expired", "FACEBOOK");
        }

        throw new SocialAPIError(
          `Failed to post to Facebook: ${axiosError.response?.data?.error?.message || axiosError.message}`,
          "FACEBOOK",
          axiosError.response?.status,
          axiosError.response?.data
        );
      }
      throw error;
    }
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

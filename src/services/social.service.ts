import prisma from "@/config/prisma";
import { PLATFORM } from "@/types/enums";
import { FacebookClient } from "@/lib/facebook-client";
import { InstagramClient } from "@/lib/instagram-client";
import { generateToken, verifyToken } from "@/utils/jwt";
import { logger } from "@/utils/logger";
import axios from "axios";

const facebookClient = new FacebookClient();
const instagramClient = new InstagramClient();

export class SocialService {
  /**
   * Connect a social account
   * In production, this would exchange an OAuth code for an access token
   * For now, accepts token directly (manual token entry for testing)
   */
  async connectAccount(
    platform: "FACEBOOK" | "INSTAGRAM",
    token: string,
    accountId: string,
    name: string
  ) {
    // Check if account already exists for this platform
    const existing = await prisma.socialAccount.findFirst({
      where: {
        platform: platform as any,
        isActive: true,
      },
    });

    if (existing) {
      // Update existing account
      return await prisma.socialAccount.update({
        where: { id: existing.id },
        data: {
          accessToken: token,
          accountId,
          name,
          isActive: true,
        },
        select: {
          id: true,
          platform: true,
          accountId: true,
          name: true,
          isActive: true,
          createdAt: true,
        },
      });
    }

    // Create new account
    return await prisma.socialAccount.create({
      data: {
        platform: platform as any,
        accessToken: token,
        accountId,
        name,
        isActive: true,
      },
      select: {
        id: true,
        platform: true,
        accountId: true,
        name: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  /**
   * Get connected accounts
   */
  async getAccounts() {
    return await prisma.socialAccount.findMany({
      where: { isActive: true },
      select: {
        id: true,
        platform: true,
        accountId: true,
        name: true,
        isActive: true,
        createdAt: true,
        // Don't return accessToken for security
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Disconnect account
   */
  async disconnectAccount(id: string) {
    return await prisma.socialAccount.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Initiate Facebook OAuth flow
   */
  initiateFacebookOAuth(userId?: string): string {
    const state = generateToken({
      id: userId || "anonymous",
      email: "oauth",
      role: "ADMIN" as any,
    });
    return facebookClient.getOAuthUrl(state);
  }

  /**
   * Initiate Instagram OAuth flow
   */
  initiateInstagramOAuth(userId?: string): string {
    const state = generateToken({
      id: userId || "anonymous",
      email: "oauth",
      role: "ADMIN" as any,
    });
    return instagramClient.getOAuthUrl(state);
  }

  /**
   * Handle Facebook OAuth callback
   */
  async handleFacebookCallback(code: string, state?: string): Promise<any> {
    try {
      // Verify state token (CSRF protection)
      if (state) {
        try {
          verifyToken(state);
        } catch (error) {
          throw new Error("Invalid state parameter");
        }
      }

      // Exchange code for short-lived token
      const tokenResponse = await facebookClient.exchangeCodeForToken(code);

      // Convert to long-lived token
      const longLivedToken = await facebookClient.getLongLivedToken(tokenResponse.access_token);

      // Get user's pages
      const pages = await facebookClient.getUserPages(longLivedToken);

      if (pages.length === 0) {
        throw new Error("No Facebook pages found. Please create a Facebook page first.");
      }

      // Use the first page (or allow user to select)
      const page = pages[0];

      // Calculate token expiry (60 days from now)
      const tokenExpiry = new Date();
      tokenExpiry.setDate(tokenExpiry.getDate() + 60);

      // Check if account already exists
      const existing = await prisma.socialAccount.findFirst({
        where: {
          platform: "FACEBOOK",
          isActive: true,
        },
      });

      if (existing) {
        // Update existing account
        return await prisma.socialAccount.update({
          where: { id: existing.id },
          data: {
            accessToken: page.access_token,
            accountId: page.id,
            name: page.name,
            tokenExpiry,
            isActive: true,
          },
          select: {
            id: true,
            platform: true,
            accountId: true,
            name: true,
            isActive: true,
            createdAt: true,
          },
        });
      }

      // Create new account
      return await prisma.socialAccount.create({
        data: {
          platform: "FACEBOOK",
          accessToken: page.access_token,
          accountId: page.id,
          name: page.name,
          tokenExpiry,
          isActive: true,
        },
        select: {
          id: true,
          platform: true,
          accountId: true,
          name: true,
          isActive: true,
          createdAt: true,
        },
      });
    } catch (error: any) {
      logger.error("Facebook OAuth callback error:", error);
      throw new Error(`Failed to connect Facebook account: ${error.message}`);
    }
  }

  /**
   * Handle Instagram OAuth callback
   */
  async handleInstagramCallback(code: string, state?: string): Promise<any> {
    try {
      // Verify state token (CSRF protection)
      if (state) {
        try {
          verifyToken(state);
        } catch (error) {
          throw new Error("Invalid state parameter");
        }
      }

      // Exchange code for short-lived token
      const tokenResponse = await instagramClient.exchangeCodeForToken(code);

      // Convert to long-lived token
      const longLivedToken = await instagramClient.getLongLivedToken(tokenResponse.access_token);

      // Get user ID from token
      const userResponse = await axios.get("https://graph.facebook.com/v18.0/me", {
        params: {
          access_token: longLivedToken,
        },
      });

      const userId = userResponse.data.id;

      // Get Instagram Business account
      const igAccount = await instagramClient.getInstagramBusinessAccount(userId, longLivedToken);

      // Calculate token expiry (60 days from now)
      const tokenExpiry = new Date();
      tokenExpiry.setDate(tokenExpiry.getDate() + 60);

      // Check if account already exists
      const existing = await prisma.socialAccount.findFirst({
        where: {
          platform: "INSTAGRAM",
          isActive: true,
        },
      });

      if (existing) {
        // Update existing account
        return await prisma.socialAccount.update({
          where: { id: existing.id },
          data: {
            accessToken: longLivedToken,
            accountId: igAccount.id,
            name: igAccount.username,
            tokenExpiry,
            isActive: true,
          },
          select: {
            id: true,
            platform: true,
            accountId: true,
            name: true,
            isActive: true,
            createdAt: true,
          },
        });
      }

      // Create new account
      return await prisma.socialAccount.create({
        data: {
          platform: "INSTAGRAM",
          accessToken: longLivedToken,
          accountId: igAccount.id,
          name: igAccount.username,
          tokenExpiry,
          isActive: true,
        },
        select: {
          id: true,
          platform: true,
          accountId: true,
          name: true,
          isActive: true,
          createdAt: true,
        },
      });
    } catch (error: any) {
      logger.error("Instagram OAuth callback error:", error);
      throw new Error(`Failed to connect Instagram account: ${error.message}`);
    }
  }

  /**
   * Post to Social Media (Real Implementation)
   */
  async postToSocial(newsId: string, platforms: PLATFORM[]) {
    const news = await prisma.news.findUnique({ where: { id: newsId } });
    if (!news) throw new Error("News not found");

    const results = [];
    const frontendUrl = process.env.CORS_ORIGIN || "http://localhost:3000";
    const articleUrl = `${frontendUrl}/news/${news.slug}`;

    for (const platform of platforms) {
      try {
        const account = await prisma.socialAccount.findFirst({
          where: { platform, isActive: true },
        });

        if (!account) {
          const log = await prisma.socialPostLog.create({
            data: {
              newsId,
              platform,
              status: "FAILED",
              message: `No active ${platform} account connected`,
            },
          });
          results.push(log);
          continue;
        }

        // Check and refresh token if needed
        await this.ensureValidToken(account.id);

        // Refresh account data after potential token refresh
        const refreshedAccount = await prisma.socialAccount.findUnique({
          where: { id: account.id },
        });

        if (!refreshedAccount || !refreshedAccount.isActive) {
          const log = await prisma.socialPostLog.create({
            data: {
              newsId,
              platform,
              status: "FAILED",
              message: `Account is inactive or token refresh failed`,
            },
          });
          results.push(log);
          continue;
        }

        // Format post content
        const postContent = {
          message: `${news.title}\n\n${news.summary}\n\nRead more: ${articleUrl}`,
          link: articleUrl,
          picture: news.mainImage || undefined,
          caption: `${news.title}\n\n${news.summary}\n\nRead more: ${articleUrl}`,
          image_url: news.mainImage || undefined,
        };

        let postResponse;

        if (platform === PLATFORM.FACEBOOK) {
          postResponse = await facebookClient.postToPage(
            refreshedAccount.accountId,
            refreshedAccount.accessToken,
            postContent
          );
        } else if (platform === PLATFORM.INSTAGRAM) {
          if (!postContent.image_url) {
            throw new Error("Image is required for Instagram posts");
          }
          postResponse = await instagramClient.postToInstagram(
            refreshedAccount.accountId,
            refreshedAccount.accessToken,
            postContent
          );
        } else {
          throw new Error(`Unsupported platform: ${platform}`);
        }

        // Log success
        const log = await prisma.socialPostLog.create({
          data: {
            newsId,
            platform,
            status: "SUCCESS",
            message: `Post ID: ${postResponse.id}`,
          },
        });
        results.push(log);
      } catch (error: any) {
        logger.error(`Failed to post to ${platform}:`, error);
        const log = await prisma.socialPostLog.create({
          data: {
            newsId,
            platform,
            status: "FAILED",
            message: error.message || "Unknown error",
          },
        });
        results.push(log);
      }
    }

    // Update news postedToSocial flag only if at least one platform succeeded
    const hasSuccess = results.some((r) => r.status === "SUCCESS");
    if (hasSuccess) {
      await prisma.news.update({
        where: { id: newsId },
        data: { postedToSocial: true },
      });
    }

    return results;
  }

  /**
   * Ensure token is valid, refresh if needed
   */
  private async ensureValidToken(accountId: string): Promise<void> {
    const account = await prisma.socialAccount.findUnique({
      where: { id: accountId },
    });

    if (!account || !account.isActive) {
      throw new Error("Account not found or inactive");
    }

    // Check if token is expired or expiring soon (within 7 days)
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    if (!account.tokenExpiry || account.tokenExpiry <= sevenDaysFromNow) {
      try {
        let refreshedToken: string;

        if (account.platform === "FACEBOOK") {
          const tokenResponse = await facebookClient.refreshToken(account.accessToken);
          refreshedToken = tokenResponse.access_token;
        } else if (account.platform === "INSTAGRAM") {
          const tokenResponse = await instagramClient.refreshToken(account.accessToken);
          refreshedToken = tokenResponse.access_token;
        } else {
          throw new Error(`Unsupported platform: ${account.platform}`);
        }

        // Update token and expiry
        const newExpiry = new Date();
        newExpiry.setDate(newExpiry.getDate() + 60); // 60 days

        await prisma.socialAccount.update({
          where: { id: accountId },
          data: {
            accessToken: refreshedToken,
            tokenExpiry: newExpiry,
          },
        });

        logger.info(`Refreshed token for ${account.platform} account ${accountId}`);
      } catch (error: any) {
        logger.error(`Failed to refresh token for account ${accountId}:`, error);
        // Mark account as inactive if refresh fails
        await prisma.socialAccount.update({
          where: { id: accountId },
          data: { isActive: false },
        });
        throw new Error(`Token refresh failed: ${error.message}`);
      }
    }
  }
}

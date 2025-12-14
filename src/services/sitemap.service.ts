import prisma from "@/config/prisma";
import env from "@/config/env";
import { cacheService } from "./cache.service";
import { NEWS_STATUS } from "@/types/enums";

export interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: number;
}

export class SitemapService {
  private readonly frontendUrl: string;

  constructor() {
    this.frontendUrl = env.FRONTEND_URL;
  }

  /**
   * Generate complete sitemap XML
   */
  async generateSitemap(): Promise<string> {
    const cacheKey = "sitemap:main";

    return await cacheService.getOrSet(
      cacheKey,
      async () => {
        const urls = await this.getAllUrls();
        return this.generateXML(urls);
      },
      3600 // 1 hour TTL
    );
  }

  /**
   * Get all URLs for sitemap
   */
  private async getAllUrls(): Promise<SitemapUrl[]> {
    const [newsUrls, categoryUrls, staticUrls] = await Promise.all([
      this.getNewsUrls(),
      this.getCategoryUrls(),
      this.getStaticUrls(),
    ]);

    return [...staticUrls, ...categoryUrls, ...newsUrls];
  }

  /**
   * Get news article URLs
   */
  private async getNewsUrls(): Promise<SitemapUrl[]> {
    const news = await prisma.news.findMany({
      where: {
        status: NEWS_STATUS.PUBLISHED,
        publishedAt: {
          not: null,
        },
      },
      select: {
        slug: true,
        updatedAt: true,
        publishedAt: true,
      },
      orderBy: {
        publishedAt: "desc",
      },
    });

    return news.map((article) => ({
      loc: `${this.frontendUrl}/news/${article.slug}`,
      lastmod: (article.updatedAt || article.publishedAt)?.toISOString(),
      changefreq: "weekly" as const,
      priority: 0.8,
    }));
  }

  /**
   * Get category URLs
   */
  private async getCategoryUrls(): Promise<SitemapUrl[]> {
    const categories = await prisma.category.findMany({
      select: {
        slug: true,
        updatedAt: true,
      },
      orderBy: {
        order: "asc",
      },
    });

    return categories.map((category) => ({
      loc: `${this.frontendUrl}/category/${category.slug}`,
      lastmod: category.updatedAt.toISOString(),
      changefreq: "weekly" as const,
      priority: 0.7,
    }));
  }

  /**
   * Get static page URLs
   */
  private getStaticUrls(): SitemapUrl[] {
    return [
      {
        loc: this.frontendUrl,
        changefreq: "daily",
        priority: 1.0,
      },
      {
        loc: `${this.frontendUrl}/weather`,
        changefreq: "daily",
        priority: 0.6,
      },
      {
        loc: `${this.frontendUrl}/horoscope`,
        changefreq: "daily",
        priority: 0.6,
      },
      {
        loc: `${this.frontendUrl}/transport`,
        changefreq: "daily",
        priority: 0.6,
      },
      {
        loc: `${this.frontendUrl}/tg`,
        changefreq: "daily",
        priority: 0.7,
      },
      {
        loc: `${this.frontendUrl}/search`,
        changefreq: "weekly",
        priority: 0.5,
      },
    ];
  }

  /**
   * Generate XML sitemap from URLs
   */
  private generateXML(urls: SitemapUrl[]): string {
    const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>\n';
    const urlsetOpen = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    const urlEntries = urls.map((url) => {
      let entry = "  <url>\n";
      entry += `    <loc>${this.escapeXML(url.loc)}</loc>\n`;

      if (url.lastmod) {
        entry += `    <lastmod>${url.lastmod}</lastmod>\n`;
      }

      if (url.changefreq) {
        entry += `    <changefreq>${url.changefreq}</changefreq>\n`;
      }

      if (url.priority !== undefined) {
        entry += `    <priority>${url.priority.toFixed(1)}</priority>\n`;
      }

      entry += "  </url>\n";
      return entry;
    });

    const urlsetClose = "</urlset>";

    return xmlHeader + urlsetOpen + urlEntries.join("") + urlsetClose;
  }

  /**
   * Escape XML special characters
   */
  private escapeXML(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  /**
   * Invalidate sitemap cache
   */
  async invalidateCache(): Promise<void> {
    await cacheService.invalidateSitemap();
  }
}

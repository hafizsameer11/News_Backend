import prisma from "@/config/prisma";
import env from "@/config/env";
import { cacheService } from "./cache.service";
import { NEWS_STATUS } from "@/types/enums";

export interface SEOMetadata {
  title: string;
  description: string;
  keywords?: string[];
  canonicalUrl: string;
  openGraph: {
    title: string;
    description: string;
    type: string;
    url: string;
    image: string;
    siteName: string;
  };
  twitterCard: {
    card: string;
    title: string;
    description: string;
    image: string;
  };
  article?: {
    publishedTime: string;
    modifiedTime: string;
    author: string;
    section: string;
    tags: string[];
  };
}

export class SEOService {
  private readonly frontendUrl: string;
  private readonly siteName: string;
  private readonly siteDescription: string;
  private readonly siteImage: string;

  constructor() {
    this.frontendUrl = env.FRONTEND_URL;
    this.siteName = env.SITE_NAME;
    this.siteDescription = env.SITE_DESCRIPTION;
    this.siteImage = env.SITE_IMAGE || `${env.FRONTEND_URL}/og-image.jpg`;
  }

  /**
   * Get SEO metadata for a news article
   */
  async getNewsMetadata(newsSlug: string): Promise<SEOMetadata> {
    const cacheKey = `seo:news:${newsSlug}`;

    return await cacheService.getOrSet(
      cacheKey,
      async () => {
        const news = await prisma.news.findUnique({
          where: { slug: newsSlug },
          include: {
            author: {
              select: {
                name: true,
              },
            },
            category: {
              select: {
                nameEn: true,
                nameIt: true,
              },
            },
          },
        });

        if (!news || news.status !== NEWS_STATUS.PUBLISHED) {
          throw new Error("News article not found or not published");
        }

        const url = `${this.frontendUrl}/news/${news.slug}`;
        const title = `${news.title} | ${this.siteName}`;
        const description = this.truncateText(news.summary, 160);
        const image = news.mainImage || this.siteImage;

        // Parse tags
        let keywords: string[] = [];
        if (news.tags) {
          try {
            keywords = JSON.parse(news.tags);
          } catch {
            keywords = news.tags.split(",").map((tag) => tag.trim());
          }
        }
        keywords.push(news.category.nameEn, news.category.nameIt);

        return {
          title,
          description,
          keywords: keywords.filter(Boolean),
          canonicalUrl: url,
          openGraph: {
            title: news.title,
            description,
            type: "article",
            url,
            image,
            siteName: this.siteName,
          },
          twitterCard: {
            card: "summary_large_image",
            title: news.title,
            description,
            image,
          },
          article: {
            publishedTime: news.publishedAt?.toISOString() || news.createdAt.toISOString(),
            modifiedTime: news.updatedAt.toISOString(),
            author: news.author.name,
            section: news.category.nameEn,
            tags: keywords.filter(Boolean),
          },
        };
      },
      3600 // 1 hour TTL
    );
  }

  /**
   * Get SEO metadata for a category page
   */
  async getCategoryMetadata(categorySlug: string): Promise<SEOMetadata> {
    const cacheKey = `seo:category:${categorySlug}`;

    return await cacheService.getOrSet(
      cacheKey,
      async () => {
        const category = await prisma.category.findUnique({
          where: { slug: categorySlug },
        });

        if (!category) {
          throw new Error("Category not found");
        }

        const url = `${this.frontendUrl}/category/${category.slug}`;
        const title = `${category.nameEn} | ${this.siteName}`;
        const description =
          category.description || `${category.nameEn} news and articles on ${this.siteName}`;
        const truncatedDescription = this.truncateText(description, 160);

        return {
          title,
          description: truncatedDescription,
          keywords: [category.nameEn, category.nameIt, "news", "articles"],
          canonicalUrl: url,
          openGraph: {
            title: category.nameEn,
            description: truncatedDescription,
            type: "website",
            url,
            image: this.siteImage,
            siteName: this.siteName,
          },
          twitterCard: {
            card: "summary",
            title: category.nameEn,
            description: truncatedDescription,
            image: this.siteImage,
          },
        };
      },
      3600 // 1 hour TTL
    );
  }

  /**
   * Get SEO metadata for homepage
   */
  getHomepageMetadata(): SEOMetadata {
    const url = this.frontendUrl;
    const title = `${this.siteName} - ${this.siteDescription}`;
    const description = this.truncateText(this.siteDescription, 160);

    return {
      title,
      description,
      keywords: ["news", "calabria", "italy", "local news", "breaking news"],
      canonicalUrl: url,
      openGraph: {
        title: this.siteName,
        description,
        type: "website",
        url,
        image: this.siteImage,
        siteName: this.siteName,
      },
      twitterCard: {
        card: "summary_large_image",
        title: this.siteName,
        description,
        image: this.siteImage,
      },
    };
  }

  /**
   * Truncate text to specified length
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength - 3) + "...";
  }
}

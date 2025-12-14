import prisma from "@/config/prisma";
import env from "@/config/env";
import { cacheService } from "./cache.service";
import { NEWS_STATUS } from "@/types/enums";

export class StructuredDataService {
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
   * Get NewsArticle structured data for a news article
   */
  async getNewsArticleStructuredData(newsSlug: string): Promise<object> {
    const cacheKey = `structured-data:news:${newsSlug}`;

    return await cacheService.getOrSet(
      cacheKey,
      async () => {
        const news = await prisma.news.findUnique({
          where: { slug: newsSlug },
          include: {
            author: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            category: {
              select: {
                id: true,
                nameEn: true,
                nameIt: true,
                slug: true,
              },
            },
          },
        });

        if (!news || news.status !== NEWS_STATUS.PUBLISHED) {
          throw new Error("News article not found or not published");
        }

        const articleUrl = `${this.frontendUrl}/news/${news.slug}`;
        const images = news.mainImage ? [news.mainImage] : [this.siteImage];

        // Parse tags if stored as JSON or comma-separated
        let keywords: string[] = [];
        if (news.tags) {
          try {
            keywords = JSON.parse(news.tags);
          } catch {
            keywords = news.tags.split(",").map((tag) => tag.trim());
          }
        }
        keywords.push(news.category.nameEn, news.category.nameIt);

        const structuredData: {
          "@context": string;
          "@type": string;
          headline: string;
          description: string;
          image: string[];
          datePublished: string | undefined;
          dateModified: string;
          author: {
            "@type": string;
            name: string;
            identifier: string;
          };
          publisher: {
            "@type": string;
            name: string;
            logo: {
              "@type": string;
              url: string;
            };
          };
          mainEntityOfPage: {
            "@type": string;
            "@id": string;
          };
          articleSection: string;
          keywords: string[];
          url: string;
          articleBody?: string;
        } = {
          "@context": "https://schema.org",
          "@type": "NewsArticle",
          headline: news.title,
          description: news.summary,
          image: images,
          datePublished: news.publishedAt?.toISOString(),
          dateModified: news.updatedAt.toISOString(),
          author: {
            "@type": "Person",
            name: news.author.name,
            identifier: news.author.id,
          },
          publisher: {
            "@type": "Organization",
            name: this.siteName,
            logo: {
              "@type": "ImageObject",
              url: this.siteImage,
            },
          },
          mainEntityOfPage: {
            "@type": "WebPage",
            "@id": articleUrl,
          },
          articleSection: news.category.nameEn,
          keywords: keywords.filter(Boolean),
          url: articleUrl,
        };

        // Optionally include article body (truncated for performance)
        if (news.content) {
          const truncatedContent = news.content.substring(0, 500);
          structuredData.articleBody = truncatedContent;
        }

        return structuredData;
      },
      3600 // 1 hour TTL
    );
  }

  /**
   * Get CollectionPage structured data for a category
   */
  async getCategoryStructuredData(categorySlug: string): Promise<object> {
    const cacheKey = `structured-data:category:${categorySlug}`;

    return await cacheService.getOrSet(
      cacheKey,
      async () => {
        const category = await prisma.category.findUnique({
          where: { slug: categorySlug },
          include: {
            news: {
              where: {
                status: NEWS_STATUS.PUBLISHED,
              },
              take: 10,
              orderBy: {
                publishedAt: "desc",
              },
              select: {
                id: true,
                title: true,
                slug: true,
                publishedAt: true,
              },
            },
          },
        });

        if (!category) {
          throw new Error("Category not found");
        }

        const categoryUrl = `${this.frontendUrl}/category/${category.slug}`;

        // Create collection of NewsArticle items
        const mainEntity = category.news.map((article) => ({
          "@type": "NewsArticle",
          headline: article.title,
          url: `${this.frontendUrl}/news/${article.slug}`,
          datePublished: article.publishedAt?.toISOString(),
        }));

        const structuredData = {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: category.nameEn,
          description: category.description || `${category.nameEn} news articles`,
          url: categoryUrl,
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: category.news.length,
            itemListElement: mainEntity,
          },
        };

        return structuredData;
      },
      3600 // 1 hour TTL
    );
  }

  /**
   * Get WebSite/Organization structured data for homepage
   */
  getWebSiteStructuredData(): object {
    const structuredData = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebSite",
          "@id": `${this.frontendUrl}/#website`,
          url: this.frontendUrl,
          name: this.siteName,
          description: this.siteDescription,
          publisher: {
            "@id": `${this.frontendUrl}/#organization`,
          },
        },
        {
          "@type": "Organization",
          "@id": `${this.frontendUrl}/#organization`,
          name: this.siteName,
          url: this.frontendUrl,
          logo: {
            "@type": "ImageObject",
            url: this.siteImage,
          },
        },
      ],
    };

    return structuredData;
  }
}

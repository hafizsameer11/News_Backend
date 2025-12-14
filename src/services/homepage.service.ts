import prisma from "@/config/prisma";
import { logger } from "@/utils/logger";
import { isJsonObject, hasStringArrayProperty } from "@/utils/type-guards";

export enum HomepageSectionType {
  HERO_SLIDER = "HERO_SLIDER",
  BREAKING_TICKER = "BREAKING_TICKER",
  FEATURED_SECTION = "FEATURED_SECTION",
  CATEGORY_BLOCK = "CATEGORY_BLOCK",
  MANUAL_LIST = "MANUAL_LIST",
}

export interface CreateHomepageSectionInput {
  type: HomepageSectionType;
  title?: string;
  dataSource?: string;
  config?: any;
  order?: number;
  isActive?: boolean;
}

export interface UpdateHomepageSectionInput {
  title?: string;
  dataSource?: string;
  config?: any;
  order?: number;
  isActive?: boolean;
}

export class HomepageService {
  /**
   * Get all homepage sections
   */
  async getAllSections() {
    const sections = await prisma.homepageSection.findMany({
      orderBy: { order: "asc" },
    });
    return sections;
  }

  /**
   * Get active homepage sections with data
   */
  async getActiveLayout() {
    const sections = await prisma.homepageSection.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
    });

    // For each section, fetch the actual data based on dataSource
    const sectionsWithData = await Promise.all(
      sections.map(async (section) => {
        let data = null;

        if (section.dataSource) {
          if (section.dataSource === "featured") {
            // Get featured news
            data = await prisma.news.findMany({
              where: { isFeatured: true, status: "PUBLISHED" },
              take: 10,
              orderBy: { createdAt: "desc" },
              select: {
                id: true,
                title: true,
                slug: true,
                mainImage: true,
                summary: true,
                createdAt: true,
              },
            });
          } else if (section.dataSource === "manual") {
            // Get manually selected news from config
            if (
              section.config &&
              isJsonObject(section.config) &&
              hasStringArrayProperty(section.config, "newsIds")
            ) {
              data = await prisma.news.findMany({
                where: {
                  id: { in: section.config.newsIds },
                  status: "PUBLISHED",
                },
                orderBy: { createdAt: "desc" },
                select: {
                  id: true,
                  title: true,
                  slug: true,
                  mainImage: true,
                  summary: true,
                  createdAt: true,
                },
              });
            }
          } else if (section.dataSource.startsWith("category:")) {
            // Get news from specific category
            const categorySlug = section.dataSource.replace("category:", "");
            const category = await prisma.category.findUnique({
              where: { slug: categorySlug },
            });
            if (category) {
              data = await prisma.news.findMany({
                where: {
                  categoryId: category.id,
                  status: "PUBLISHED",
                },
                take: 10,
                orderBy: { createdAt: "desc" },
                select: {
                  id: true,
                  title: true,
                  slug: true,
                  mainImage: true,
                  summary: true,
                  createdAt: true,
                },
              });
            }
          }
        }

        return {
          ...section,
          data,
        };
      })
    );

    return sectionsWithData;
  }

  /**
   * Get section by ID
   */
  async getSectionById(id: string) {
    const section = await prisma.homepageSection.findUnique({
      where: { id },
    });

    if (!section) {
      throw new Error("Homepage section not found");
    }

    return section;
  }

  /**
   * Create homepage section
   */
  async createSection(data: CreateHomepageSectionInput) {
    // If no order specified, add to end
    if (data.order === undefined) {
      const maxOrder = await prisma.homepageSection.findFirst({
        orderBy: { order: "desc" },
        select: { order: true },
      });
      data.order = (maxOrder?.order ?? -1) + 1;
    }

    const section = await prisma.homepageSection.create({
      data: {
        type: data.type as any,
        title: data.title,
        dataSource: data.dataSource,
        config: data.config ? JSON.parse(JSON.stringify(data.config)) : null,
        order: data.order,
        isActive: data.isActive ?? true,
      },
    });

    logger.info(`Homepage section created: ${section.id}`);
    return section;
  }

  /**
   * Update homepage section
   */
  async updateSection(id: string, data: UpdateHomepageSectionInput) {
    const section = await prisma.homepageSection.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.dataSource !== undefined && { dataSource: data.dataSource }),
        ...(data.config !== undefined && {
          config: data.config ? JSON.parse(JSON.stringify(data.config)) : null,
        }),
        ...(data.order !== undefined && { order: data.order }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });

    logger.info(`Homepage section updated: ${id}`);
    return section;
  }

  /**
   * Delete homepage section
   */
  async deleteSection(id: string) {
    await prisma.homepageSection.delete({
      where: { id },
    });

    logger.info(`Homepage section deleted: ${id}`);
  }

  /**
   * Reorder sections
   */
  async reorderSections(sectionIds: string[]) {
    const updates = sectionIds.map((id, index) =>
      prisma.homepageSection.update({
        where: { id },
        data: { order: index },
      })
    );

    await Promise.all(updates);
    logger.info(`Homepage sections reordered`);
  }
}

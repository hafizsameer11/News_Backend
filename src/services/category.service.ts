import prisma from "@/config/prisma";
import { cacheService } from "./cache.service";

export class CategoryService {
  /**
   * Calculate the next order value for a category based on its parent
   * @param parentId - Parent category ID (null for root categories)
   * @returns Next order value
   */
  private async calculateNextOrder(parentId: string | null | undefined): Promise<number> {
    const maxOrder = await prisma.category.findFirst({
      where: { parentId: parentId || null },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    return maxOrder ? maxOrder.order + 1 : 0;
  }

  /**
   * Get all categories (Hierarchical or Flat)
   */
  async getAllCategories(flat = false) {
    if (flat) {
      return await prisma.category.findMany({
        orderBy: { order: "asc" },
      });
    }

    // Hierarchical fetch (Parents with children) - up to 4 levels deep
    return await prisma.category.findMany({
      where: { parentId: null },
      include: {
        children: {
          orderBy: { order: "asc" },
          include: {
            children: {
              orderBy: { order: "asc" },
              include: {
                children: {
                  orderBy: { order: "asc" },
                  include: {
                    children: {
                      orderBy: { order: "asc" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { order: "asc" },
    });
  }

  /**
   * Get category by ID
   */
  async getCategoryById(id: string) {
    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        children: true,
        parent: true,
      },
    });

    if (!category) throw new Error("Category not found");

    return category;
  }

  /**
   * Get category by slug
   */
  async getCategoryBySlug(slug: string) {
    const category = await prisma.category.findUnique({
      where: { slug },
      include: {
        children: true,
        parent: true,
      },
    });

    if (!category) throw new Error("Category not found");

    return category;
  }

  /**
   * Create category
   */
  async createCategory(data: any) {
    // Check slug uniqueness
    const existing = await prisma.category.findUnique({
      where: { slug: data.slug },
    });

    if (existing) throw new Error("Slug already exists");

    // Verify parent category exists if parentId is provided
    if (data.parentId) {
      const parent = await prisma.category.findUnique({
        where: { id: data.parentId },
      });
      if (!parent) throw new Error("Parent category not found");
    }

    // Auto-calculate order if not provided
    const order =
      data.order !== undefined ? data.order : await this.calculateNextOrder(data.parentId);

    const category = await prisma.category.create({
      data: {
        ...data,
        order,
      },
    });

    // Invalidate cache
    await cacheService.invalidateCategory(category.id);
    await cacheService.invalidateSitemap();

    return category;
  }

  /**
   * Update category
   */
  async updateCategory(id: string, data: any) {
    // Prevent setting itself as parent (circular reference)
    if (data.parentId === id) {
      throw new Error("Category cannot be its own parent");
    }

    // Verify parent category exists if parentId is being changed
    if (data.parentId !== undefined) {
      if (data.parentId === null) {
        // Setting to null is allowed (making it a root category)
      } else {
        const parent = await prisma.category.findUnique({
          where: { id: data.parentId },
        });
        if (!parent) throw new Error("Parent category not found");
      }
    }

    // Check slug uniqueness if updating slug
    if (data.slug) {
      const existing = await prisma.category.findUnique({
        where: { slug: data.slug },
      });

      if (existing && existing.id !== id) {
        throw new Error("Slug already exists");
      }
    }

    const category = await prisma.category.update({
      where: { id },
      data,
    });

    // Invalidate cache
    await cacheService.invalidateCategory(id);
    await cacheService.invalidateSitemap();

    return category;
  }

  /**
   * Update category order (bulk)
   */
  async updateCategoryOrder(updates: Array<{ id: string; order: number }>) {
    // Use transaction to ensure atomicity
    return await prisma.$transaction(
      updates.map((update) =>
        prisma.category.update({
          where: { id: update.id },
          data: { order: update.order },
        })
      )
    );
  }

  /**
   * Delete category
   */
  async deleteCategory(id: string) {
    // Check if has children
    const hasChildren = await prisma.category.findFirst({
      where: { parentId: id },
    });

    if (hasChildren) {
      throw new Error("Cannot delete category with subcategories");
    }

    // Check if has news
    // Ideally we should prevent deletion or move news, but for now throwing error
    const newsCount = await prisma.news.count({ where: { categoryId: id } });
    if (newsCount > 0) {
      throw new Error("Cannot delete category containing news articles");
    }

    // Invalidate cache before deletion
    await cacheService.invalidateCategory(id);
    await cacheService.invalidateSitemap();

    return await prisma.category.delete({
      where: { id },
    });
  }
}

import prisma from "@/config/prisma";
import bcrypt from "bcryptjs";
import { ROLE } from "@/types/enums";
import { Role } from "@prisma/client";
import { logger } from "@/utils/logger";

export class UserService {
  /**
   * Get all users (Admin only)
   */
  async getAllUsers(page = 1, limit = 10, role?: ROLE) {
    const skip = (page - 1) * limit;

    const where = role ? { role: role as any } : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
          socialPostingAllowed: true,
          allowedCategories: {
            select: {
              id: true,
              nameEn: true,
              nameIt: true,
            },
          },
          _count: {
            select: { newsAuthored: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        allowedCategories: true,
      },
    });

    if (!user) throw new Error("User not found");

    const { password: _password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Create new user (Admin)
   */
  async createUser(data: any) {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) throw new Error("Email already exists");

    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Extract categoryIds if provided (for Editor role)
    const { categoryIds, ...userData } = data;

    const createData: any = {
      ...userData,
      password: hashedPassword,
      role: data.role as any,
    };

    // If categoryIds provided and user is Editor, assign categories
    if (categoryIds && Array.isArray(categoryIds) && categoryIds.length > 0) {
      // Verify categories exist
      const categories = await prisma.category.findMany({
        where: { id: { in: categoryIds } },
      });

      if (categories.length !== categoryIds.length) {
        throw new Error("Some categories not found");
      }

      createData.allowedCategories = {
        connect: categoryIds.map((id: string) => ({ id })),
      };
    }

    const user = await prisma.user.create({
      data: createData,
      include: {
        allowedCategories: true,
      },
    });

    const { password: _password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Update user
   */
  async updateUser(id: string, data: any) {
    // Extract categoryIds if provided
    const { categoryIds, ...userData } = data;

    const updateData: any = {
      ...userData,
      role: data.role ? (data.role as any) : undefined,
    };

    // If categoryIds provided, update categories
    if (categoryIds !== undefined) {
      if (Array.isArray(categoryIds) && categoryIds.length > 0) {
        // Verify categories exist
        const categories = await prisma.category.findMany({
          where: { id: { in: categoryIds } },
        });

        if (categories.length !== categoryIds.length) {
          throw new Error("Some categories not found");
        }

        updateData.allowedCategories = {
          set: categoryIds.map((id: string) => ({ id })),
        };
      } else {
        // Empty array means remove all categories
        updateData.allowedCategories = {
          set: [],
        };
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        allowedCategories: true,
      },
    });

    const { password: _password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Delete user
   * Handles cascading deletion of related records
   */
  async deleteUser(id: string) {
    // Check if user has authored news (authorId is required, can't be null)
    const newsCount = await prisma.news.count({
      where: { authorId: id },
    });

    if (newsCount > 0) {
      throw new Error(
        `Cannot delete user: User has authored ${newsCount} news article(s). Please reassign or delete the news articles first.`
      );
    }

    // Delete or update related records first to avoid foreign key constraint errors
    await Promise.all([
      // Delete chat messages where user is sender or receiver
      prisma.chat.deleteMany({
        where: {
          OR: [{ senderId: id }, { receiverId: id }],
        },
      }),
      // Delete user's transactions
      prisma.transaction.deleteMany({
        where: { userId: id },
      }),
      // Delete user's reports
      prisma.report.deleteMany({
        where: { userId: id },
      }),
      // Delete user's audit logs
      prisma.auditLog.deleteMany({
        where: { userId: id },
      }),
      // Set ad advertiser to null (advertiserId is optional)
      prisma.ad.updateMany({
        where: { advertiserId: id },
        data: { advertiserId: null },
      }),
    ]);

    // Note: Bookmarks are already handled by onDelete: Cascade in schema
    // But we'll delete them explicitly for safety
    await prisma.bookmark.deleteMany({
      where: { userId: id },
    });

    // Now delete the user
    return await prisma.user.delete({
      where: { id },
    });
  }

  /**
   * Assign allowed categories to editor
   */
  async assignCategories(userId: string, categoryIds: string[]) {
    // Verify user is editor
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("User not found");

    // Update categories
    return await prisma.user.update({
      where: { id: userId },
      data: {
        allowedCategories: {
          set: categoryIds.map((id) => ({ id })),
        },
      },
      include: {
        allowedCategories: true,
      },
    });
  }

  /**
   * Get all Pro Loco users (pending, approved, rejected)
   */
  async getProlocoUsers(status?: string) {
    const where: any = { role: Role.PROLOCO };
    if (status) {
      where.prolocoStatus = status;
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        prolocoCity: true,
        prolocoName: true,
        prolocoCode: true,
        prolocoPresident: true,
        prolocoPresidentTel: true,
        prolocoPresidentMail: true,
        prolocoTel: true,
        prolocoWebsite: true,
        prolocoStatus: true,
        prolocoApprovedAt: true,
        prolocoAllowedCategories: {
          select: {
            id: true,
            nameEn: true,
            nameIt: true,
            slug: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      } as any,
      orderBy: { createdAt: "desc" },
    });

    return users;
  }

  /**
   * Approve Pro Loco user and optionally assign categories
   */
  async approveProloco(userId: string, categoryIds: string[] = [], approvedBy: string) {
    // Verify user exists and is Pro Loco
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("User not found");
    if (user.role !== Role.PROLOCO) throw new Error("User is not a Pro Loco user");

    // Verify categories exist if provided
    if (categoryIds.length > 0) {
      const categories = await prisma.category.findMany({
        where: { id: { in: categoryIds } },
      });
      if (categories.length !== categoryIds.length) {
        throw new Error("Some categories not found");
      }
    }

    // Update user status and assign categories
    const updateData: any = {
      prolocoStatus: "APPROVED",
      prolocoApprovedAt: new Date(),
      prolocoApprovedBy: approvedBy,
      emailVerified: true, // Auto-verify email on approval
    };

    // Assign categories if provided
    if (categoryIds.length > 0) {
      updateData.prolocoAllowedCategories = {
        set: categoryIds.map((id) => ({ id })),
      };
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      include: {
        prolocoAllowedCategories: {
          select: {
            id: true,
            nameEn: true,
            nameIt: true,
            slug: true,
          },
        },
      } as any,
    });

    // TODO: Send approval email to Pro Loco user
    logger.info(`Pro Loco user approved: ${updatedUser.email} (${(updatedUser as any).prolocoCode})`);

    const { password: _password, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword;
  }

  /**
   * Reject Pro Loco user
   */
  async rejectProloco(userId: string, rejectedBy: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("User not found");
    if (user.role !== Role.PROLOCO) throw new Error("User is not a Pro Loco user");

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        prolocoStatus: "REJECTED",
        prolocoApprovedBy: rejectedBy,
      } as any,
    });

    // TODO: Send rejection email to Pro Loco user
    logger.info(`Pro Loco user rejected: ${updatedUser.email} (${(updatedUser as any).prolocoCode})`);

    const { password: _password, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword;
  }

  /**
   * Assign categories to Pro Loco user
   */
  async assignProlocoCategories(userId: string, categoryIds: string[]) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("User not found");
    if (user.role !== Role.PROLOCO) throw new Error("User is not a Pro Loco user");

    // Verify categories exist
    if (categoryIds.length > 0) {
      const categories = await prisma.category.findMany({
        where: { id: { in: categoryIds } },
      });
      if (categories.length !== categoryIds.length) {
        throw new Error("Some categories not found");
      }
    }

    return await prisma.user.update({
      where: { id: userId },
      data: {
        prolocoAllowedCategories: {
          set: categoryIds.map((id) => ({ id })),
        },
      } as any,
      include: {
        prolocoAllowedCategories: {
          select: {
            id: true,
            nameEn: true,
            nameIt: true,
            slug: true,
          },
        },
      } as any,
    });
  }
}

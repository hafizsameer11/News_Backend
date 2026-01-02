import prisma from "@/config/prisma";
import { MemoType } from "@prisma/client";

export class MemoService {
  /**
   * Create a new memo for a user
   */
  async createMemo(data: {
    type: MemoType;
    message: string;
    when: number;
    userId: string;
    createdById: string;
  }) {
    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: data.userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Verify creator exists
    const creator = await prisma.user.findUnique({
      where: { id: data.createdById },
    });

    if (!creator) {
      throw new Error("Creator not found");
    }

    return await prisma.memo.create({
      data: {
        type: data.type,
        message: data.message,
        when: data.when,
        userId: data.userId,
        createdById: data.createdById,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            role: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            role: true,
          },
        },
      },
    });
  }

  /**
   * Get all memos for a specific user
   */
  async getMemosByUser(userId: string) {
    return await prisma.memo.findMany({
      where: {
        userId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            role: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  /**
   * Delete a memo
   */
  async deleteMemo(memoId: string, adminId: string) {
    // Verify memo exists and was created by the admin (or admin is super admin)
    const memo = await prisma.memo.findUnique({
      where: { id: memoId },
      include: {
        createdBy: {
          select: {
            id: true,
            role: true,
          },
        },
      },
    });

    if (!memo) {
      throw new Error("Memo not found");
    }

    // Check if admin can delete (creator or super admin)
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { role: true },
    });

    if (!admin) {
      throw new Error("Admin not found");
    }

    if (memo.createdById !== adminId && admin.role !== "SUPER_ADMIN") {
      throw new Error("Unauthorized to delete this memo");
    }

    return await prisma.memo.delete({
      where: { id: memoId },
    });
  }
}


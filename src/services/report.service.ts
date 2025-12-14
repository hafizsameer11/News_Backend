import prisma from "@/config/prisma";

export class ReportService {
  /**
   * Create a new report
   */
  async createReport(data: any, userId?: string) {
    // Convert empty string to null for mediaUrl
    const mediaUrl = data.mediaUrl && data.mediaUrl.trim() !== "" ? data.mediaUrl.trim() : null;

    return await prisma.report.create({
      data: {
        content: data.content,
        mediaUrl: mediaUrl,
        contactInfo: data.contactInfo || null,
        userId: userId || null,
      },
    });
  }

  /**
   * Get all reports (Admin)
   */
  async getAllReports(query: any) {
    const { page = 1, limit = 20, isResolved, status } = query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    // Support both 'isResolved' and 'status' query parameters
    if (isResolved !== undefined) {
      where.isResolved = isResolved === "true";
    } else if (status !== undefined) {
      if (status === "resolved") {
        where.isResolved = true;
      } else if (status === "pending") {
        where.isResolved = false;
      }
    }

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { name: true, email: true } },
        },
      }),
      prisma.report.count({ where }),
    ]);

    return {
      reports,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    };
  }

  /**
   * Resolve report (Admin)
   */
  async resolveReport(id: string) {
    return await prisma.report.update({
      where: { id },
      data: { isResolved: true },
    });
  }
}

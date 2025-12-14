import prisma from "@/config/prisma";
import { serializeBigInt } from "@/utils/serialize";

export type ExportFormat = "csv" | "json";
export type ExportType = "audit-logs" | "user-behavior" | "news-views" | "ad-analytics";

export interface ExportOptions {
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

export class ExportService {
  /**
   * Export audit logs
   */
  async exportAuditLogs(format: ExportFormat, options?: ExportOptions): Promise<string> {
    const where: any = {};

    if (options?.startDate || options?.endDate) {
      where.createdAt = {};
      if (options.startDate) {
        where.createdAt.gte = options.startDate;
      }
      if (options.endDate) {
        where.createdAt.lte = options.endDate;
      }
    }

    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: options?.limit || 10000,
    });

    if (format === "json") {
      return JSON.stringify(serializeBigInt(logs), null, 2);
    }

    // CSV format
    const headers = [
      "ID",
      "Action",
      "Method",
      "Endpoint",
      "User ID",
      "User Email",
      "User Name",
      "IP Address",
      "User Agent",
      "Response Status",
      "Created At",
    ];

    const rows = logs.map((log) => [
      log.id,
      log.action,
      log.method || "",
      log.endpoint || "",
      log.userId || "",
      log.user?.email || "",
      log.user?.name || "",
      log.ipAddress || "",
      log.userAgent || "",
      log.responseStatus?.toString() || "",
      log.createdAt.toISOString(),
    ]);

    return this.arrayToCSV([headers, ...rows]);
  }

  /**
   * Export user behavior events
   */
  async exportUserBehavior(format: ExportFormat, options?: ExportOptions): Promise<string> {
    const where: any = {};

    if (options?.startDate || options?.endDate) {
      where.createdAt = {};
      if (options.startDate) {
        where.createdAt.gte = options.startDate;
      }
      if (options.endDate) {
        where.createdAt.lte = options.endDate;
      }
    }

    const events = await prisma.userBehaviorEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: options?.limit || 10000,
    });

    if (format === "json") {
      return JSON.stringify(serializeBigInt(events), null, 2);
    }

    // CSV format
    const headers = [
      "ID",
      "User ID",
      "Event Type",
      "Event Data",
      "IP Address",
      "User Agent",
      "Created At",
    ];

    const rows = events.map((event) => [
      event.id,
      event.userId || "",
      event.eventType,
      event.eventData || "",
      event.ipAddress || "",
      event.userAgent || "",
      event.createdAt.toISOString(),
    ]);

    return this.arrayToCSV([headers, ...rows]);
  }

  /**
   * Export news view logs
   */
  async exportNewsViews(format: ExportFormat, options?: ExportOptions): Promise<string> {
    const where: any = {};

    if (options?.startDate || options?.endDate) {
      where.viewedAt = {};
      if (options.startDate) {
        where.viewedAt.gte = options.startDate;
      }
      if (options.endDate) {
        where.viewedAt.lte = options.endDate;
      }
    }

    const views = await prisma.newsViewLog.findMany({
      where,
      include: {
        news: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
      orderBy: { viewedAt: "desc" },
      take: options?.limit || 10000,
    });

    if (format === "json") {
      return JSON.stringify(serializeBigInt(views), null, 2);
    }

    // CSV format
    const headers = [
      "ID",
      "News ID",
      "News Title",
      "News Slug",
      "User ID",
      "IP Address",
      "User Agent",
      "Viewed At",
    ];

    const rows = views.map((view) => [
      view.id,
      view.newsId,
      view.news.title,
      view.news.slug,
      view.userId || "",
      view.ipAddress || "",
      view.userAgent || "",
      view.viewedAt.toISOString(),
    ]);

    return this.arrayToCSV([headers, ...rows]);
  }

  /**
   * Export ad analytics
   */
  async exportAdAnalytics(format: ExportFormat, options?: ExportOptions): Promise<string> {
    const where: any = {};

    if (options?.startDate || options?.endDate) {
      where.createdAt = {};
      if (options.startDate) {
        where.createdAt.gte = options.startDate;
      }
      if (options.endDate) {
        where.createdAt.lte = options.endDate;
      }
    }

    const ads = await prisma.ad.findMany({
      where,
      include: {
        advertiser: {
          select: {
            id: true,
            email: true,
            name: true,
            companyName: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: options?.limit || 10000,
    });

    if (format === "json") {
      return JSON.stringify(serializeBigInt(ads), null, 2);
    }

    // CSV format
    const headers = [
      "ID",
      "Title",
      "Type",
      "Status",
      "Advertiser ID",
      "Advertiser Email",
      "Advertiser Name",
      "Company Name",
      "Impressions",
      "Clicks",
      "CTR",
      "Price",
      "Start Date",
      "End Date",
      "Created At",
    ];

    const rows = ads.map((ad) => {
      const ctr = ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(2) : "0.00";
      return [
        ad.id,
        ad.title,
        ad.type,
        ad.status,
        ad.advertiserId || "",
        ad.advertiser?.email || "",
        ad.advertiser?.name || "",
        ad.advertiser?.companyName || "",
        ad.impressions.toString(),
        ad.clicks.toString(),
        ctr,
        ad.price?.toString() || "",
        ad.startDate.toISOString(),
        ad.endDate.toISOString(),
        ad.createdAt.toISOString(),
      ];
    });

    return this.arrayToCSV([headers, ...rows]);
  }

  /**
   * Convert array to CSV string
   */
  private arrayToCSV(data: any[][]): string {
    return data
      .map((row) =>
        row
          .map((cell) => {
            // Escape quotes and wrap in quotes if contains comma, quote, or newline
            const cellStr = String(cell || "");
            if (cellStr.includes(",") || cellStr.includes('"') || cellStr.includes("\n")) {
              return `"${cellStr.replace(/"/g, '""')}"`;
            }
            return cellStr;
          })
          .join(",")
      )
      .join("\n");
  }

  /**
   * Export data based on type
   */
  async export(type: ExportType, format: ExportFormat, options?: ExportOptions): Promise<string> {
    switch (type) {
      case "audit-logs":
        return this.exportAuditLogs(format, options);
      case "user-behavior":
        return this.exportUserBehavior(format, options);
      case "news-views":
        return this.exportNewsViews(format, options);
      case "ad-analytics":
        return this.exportAdAnalytics(format, options);
      default:
        throw new Error(`Unknown export type: ${type}`);
    }
  }
}

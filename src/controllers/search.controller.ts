import { Request, Response } from "express";
import { SearchService, SearchFilters } from "@/services/search.service";
import { successResponse } from "@/utils/response";

const searchService = new SearchService();

export const searchController = {
  search: async (req: Request, res: Response) => {
    // Handle categoryId as either string or array (when multiple query params with same name)
    let categoryId: string | string[] | undefined;
    if (req.query.categoryId) {
      if (Array.isArray(req.query.categoryId)) {
        categoryId = req.query.categoryId as string[];
      } else {
        categoryId = req.query.categoryId as string;
      }
    }

    const filters: SearchFilters = {
      q: (req.query.q as string) || "",
      type: (req.query.type as any) || "all",
      categoryId,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
      sort: (req.query.sort as any) || "relevance",
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
    };

    const result = await searchService.search(filters);
    return successResponse(res, "Search results", result);
  },
};

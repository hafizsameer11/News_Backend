import { Request, Response } from "express";
import { HomepageService } from "@/services/homepage.service";
import { successResponse } from "@/utils/response";

const homepageService = new HomepageService();

export const homepageController = {
  getAll: async (_req: Request, res: Response) => {
    const result = await homepageService.getAllSections();
    return successResponse(res, "Homepage sections retrieved", result);
  },

  getActiveLayout: async (_req: Request, res: Response) => {
    const result = await homepageService.getActiveLayout();
    return successResponse(res, "Homepage layout retrieved", result);
  },

  getOne: async (req: Request, res: Response) => {
    const result = await homepageService.getSectionById(req.params.id);
    return successResponse(res, "Homepage section retrieved", result);
  },

  create: async (req: Request, res: Response) => {
    const result = await homepageService.createSection(req.body);
    return successResponse(res, "Homepage section created", result, 201);
  },

  update: async (req: Request, res: Response) => {
    const result = await homepageService.updateSection(req.params.id, req.body);
    return successResponse(res, "Homepage section updated", result);
  },

  delete: async (req: Request, res: Response) => {
    await homepageService.deleteSection(req.params.id);
    return successResponse(res, "Homepage section deleted");
  },

  reorder: async (req: Request, res: Response) => {
    const { sectionIds } = req.body;
    await homepageService.reorderSections(sectionIds);
    return successResponse(res, "Sections reordered");
  },
};

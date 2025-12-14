import { Request, Response } from "express";
import { CategoryService } from "@/services/category.service";
import { successResponse } from "@/utils/response";

const categoryService = new CategoryService();

export const categoryController = {
  getAll: async (req: Request, res: Response) => {
    const flat = req.query.flat === "true";
    const result = await categoryService.getAllCategories(flat);
    return successResponse(res, "Categories retrieved", result);
  },

  getOne: async (req: Request, res: Response) => {
    const result = await categoryService.getCategoryById(req.params.id);
    return successResponse(res, "Category retrieved", result);
  },

  getBySlug: async (req: Request, res: Response) => {
    const result = await categoryService.getCategoryBySlug(req.params.slug);
    return successResponse(res, "Category retrieved", result);
  },

  create: async (req: Request, res: Response) => {
    const result = await categoryService.createCategory(req.body);
    return successResponse(res, "Category created", result, 201);
  },

  update: async (req: Request, res: Response) => {
    const result = await categoryService.updateCategory(req.params.id, req.body);
    return successResponse(res, "Category updated", result);
  },

  updateOrder: async (req: Request, res: Response) => {
    const updates = req.body.updates; // Array of { id, order }
    if (!Array.isArray(updates)) {
      return res.status(400).json({ success: false, message: "Updates must be an array" });
    }
    const result = await categoryService.updateCategoryOrder(updates);
    return successResponse(res, "Category order updated", result);
  },

  delete: async (req: Request, res: Response) => {
    await categoryService.deleteCategory(req.params.id);
    return successResponse(res, "Category deleted");
  },
};

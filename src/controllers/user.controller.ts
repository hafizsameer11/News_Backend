import { Request, Response } from "express";
import { UserService } from "@/services/user.service";
import { successResponse } from "@/utils/response";
import { ROLE } from "@/types/enums";
import { AuthenticatedRequest } from "@/types/global.types";

const userService = new UserService();

export const userController = {
  getAll: async (req: Request, res: Response) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const role = req.query.role as ROLE;

    const result = await userService.getAllUsers(page, limit, role);
    return successResponse(res, "Users retrieved successfully", result);
  },

  getOne: async (req: Request, res: Response) => {
    const result = await userService.getUserById(req.params.id);
    return successResponse(res, "User retrieved successfully", result);
  },

  create: async (req: Request, res: Response) => {
    const result = await userService.createUser(req.body);
    return successResponse(res, "User created successfully", result, 201);
  },

  update: async (req: Request, res: Response) => {
    const result = await userService.updateUser(req.params.id, req.body);
    return successResponse(res, "User updated successfully", result);
  },

  delete: async (req: Request, res: Response) => {
    await userService.deleteUser(req.params.id);
    return successResponse(res, "User deleted successfully");
  },

  assignCategories: async (req: Request, res: Response) => {
    const result = await userService.assignCategories(req.params.id, req.body.categoryIds);
    return successResponse(res, "Categories assigned successfully", result);
  },

  getProlocoUsers: async (req: Request, res: Response) => {
    const status = req.query.status as string | undefined;
    const result = await userService.getProlocoUsers(status);
    return successResponse(res, "Pro Loco users retrieved successfully", result);
  },

  approveProloco: async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw new Error("Not authenticated");
    const { userId, categoryIds = [] } = req.body;
    const result = await userService.approveProloco(userId, categoryIds, req.user.id);
    return successResponse(res, "Pro Loco user approved successfully", result);
  },

  rejectProloco: async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw new Error("Not authenticated");
    const { userId } = req.body;
    const result = await userService.rejectProloco(userId, req.user.id);
    return successResponse(res, "Pro Loco user rejected", result);
  },

  assignProlocoCategories: async (req: Request, res: Response) => {
    const result = await userService.assignProlocoCategories(req.params.id, req.body.categoryIds);
    return successResponse(res, "Categories assigned successfully", result);
  },
};

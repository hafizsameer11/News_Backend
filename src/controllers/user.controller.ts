import { Request, Response } from "express";
import { UserService } from "@/services/user.service";
import { successResponse } from "@/utils/response";
import { ROLE } from "@/types/enums";

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
};

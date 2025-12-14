import { Request, Response } from "express";
import { TransportService } from "@/services/transport.service";
import { successResponse } from "@/utils/response";

const transportService = new TransportService();

export const transportController = {
  getAll: async (req: Request, res: Response) => {
    const result = await transportService.getAll(req.query);
    return successResponse(res, "Transport data retrieved", result);
  },

  create: async (req: Request, res: Response) => {
    const result = await transportService.create(req.body);
    return successResponse(res, "Entry created", result, 201);
  },

  update: async (req: Request, res: Response) => {
    const result = await transportService.update(req.params.id, req.body);
    return successResponse(res, "Entry updated", result);
  },

  delete: async (req: Request, res: Response) => {
    await transportService.delete(req.params.id);
    return successResponse(res, "Entry deleted");
  },
};

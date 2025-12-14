import { Request, Response } from "express";
import { NewsletterService } from "@/services/newsletter.service";
import { successResponse } from "@/utils/response";

const newsletterService = new NewsletterService();

export const newsletterController = {
  subscribe: async (req: Request, res: Response) => {
    const result = await newsletterService.subscribe(req.body.email);
    return successResponse(res, "Subscribed successfully", result);
  },

  unsubscribe: async (req: Request, res: Response) => {
    await newsletterService.unsubscribe(req.body.email);
    return successResponse(res, "Unsubscribed successfully");
  },

  getAll: async (req: Request, res: Response) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const result = await newsletterService.getAllSubscribers(page, limit);
    return successResponse(res, "Subscribers retrieved", result);
  },

  send: async (req: Request, res: Response) => {
    const { subject, html, text } = req.body;
    const result = await newsletterService.sendNewsletterToSubscribers(subject, html, text);
    return successResponse(res, "Newsletter queued for sending", result);
  },

  updateStatus: async (req: Request, res: Response) => {
    const { id } = req.params;
    const { isActive } = req.body;
    const result = await newsletterService.updateSubscriberStatus(id, isActive);
    return successResponse(
      res,
      `Subscriber ${isActive ? "activated" : "deactivated"} successfully`,
      result
    );
  },

  delete: async (req: Request, res: Response) => {
    const { id } = req.params;
    await newsletterService.deleteSubscriber(id);
    return successResponse(res, "Subscriber deleted successfully");
  },
};

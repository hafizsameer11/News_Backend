import prisma from "@/config/prisma";

/**
 * Base Repository
 * Example repository structure
 *
 * Repositories should:
 * - Only interact with Prisma
 * - Have NO business logic
 * - Return DB results
 */
export abstract class BaseRepository {
  protected prisma = prisma;

  // Add common repository methods here if needed
}

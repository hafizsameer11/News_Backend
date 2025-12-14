import prisma from "@/config/prisma";

export class TransportService {
  /**
   * Get all transport entries (with filters)
   */
  async getAll(query: any) {
    const { type, city, search } = query;
    const where: any = {};

    if (type) where.type = type;
    if (city) where.city = { contains: city }; // removed mode: 'insensitive' for mysql
    if (search) {
      where.OR = [
        { name: { contains: search } }, // removed mode: 'insensitive' for mysql
        { description: { contains: search } }, // removed mode: 'insensitive' for mysql
      ];
    }

    return await prisma.transport.findMany({
      where,
      orderBy: { name: "asc" },
    });
  }

  /**
   * Create transport entry
   */
  async create(data: any) {
    return await prisma.transport.create({
      data,
    });
  }

  /**
   * Update transport entry
   */
  async update(id: string, data: any) {
    return await prisma.transport.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete transport entry
   */
  async delete(id: string) {
    return await prisma.transport.delete({
      where: { id },
    });
  }
}

import { PrismaClient } from "@prisma/client";
import { logger } from "@/utils/logger";

const prisma = new PrismaClient({
  log: [
    { level: "query", emit: "event" },
    { level: "error", emit: "stdout" },
    { level: "warn", emit: "stdout" },
  ],
});

// Log queries only if PRISMA_DEBUG is enabled (optional, very verbose)
if (process.env.PRISMA_DEBUG === "true") {
  prisma.$on("query" as never, (e: any) => {
    logger.debug("Query: " + e.query);
    logger.debug("Params: " + e.params);
    logger.debug("Duration: " + e.duration + "ms");
  });
}

// Graceful shutdown
process.on("beforeExit", async () => {
  await prisma.$disconnect();
  logger.info("Prisma client disconnected");
});

export default prisma;

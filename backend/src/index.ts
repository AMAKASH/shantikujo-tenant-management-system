import { createApp } from "./app.js";
import { config } from "./config.js";
import { startScheduler } from "./jobs/scheduler.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";

const app = createApp();
const server = app.listen(config.PORT, config.HOST, () => {
  logger.info(`STMS API listening on http://${config.HOST}:${config.PORT}`);
});

if (config.ENABLE_CRON) startScheduler();

const shutdown = async (signal: string) => {
  logger.info(`${signal} received, shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

import { randomUUID } from "node:crypto";
import cookieParser from "cookie-parser";
import express, { Router } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { isProd } from "./config.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import { requireAuth, requireRole } from "./middleware/auth.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { apartmentsRouter } from "./modules/apartments/routes.js";
import { authRouter } from "./modules/auth/routes.js";
import { dashboardRouter } from "./modules/dashboard/routes.js";
import { documentsRouter } from "./modules/documents/routes.js";
import { invoicesRouter } from "./modules/invoices/routes.js";
import { leasesRouter } from "./modules/leases/routes.js";
import { meterReadingsRouter } from "./modules/meter-readings/routes.js";
import { paymentsRouter } from "./modules/payments/routes.js";
import { reportsRouter } from "./modules/reports/routes.js";
import { settingsRouter } from "./modules/settings/routes.js";
import { tenantsRouter } from "./modules/tenants/routes.js";

export function createApp() {
  const app = express();
  // Behind Next.js (and Traefik on Dokploy): trust the proxy chain for req.ip / secure cookies.
  app.set("trust proxy", true);
  app.disable("x-powered-by");

  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const id = (req.headers["x-request-id"] as string) || randomUUID();
        res.setHeader("x-request-id", id);
        return id;
      },
      autoLogging: { ignore: (req) => req.url === "/api/health" },
    }),
  );
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: "same-origin" } }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  const api = Router();

  api.get("/health", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: "ok", db: "ok", env: isProd ? "production" : "development" });
    } catch {
      res.status(503).json({ status: "error", db: "unreachable" });
    }
  });

  api.use("/auth", authRouter);

  // Everything below requires an admin session.
  const admin = Router();
  admin.use(requireAuth, requireRole("ADMIN"));
  admin.use("/dashboard", dashboardRouter);
  admin.use("/apartments", apartmentsRouter);
  admin.use("/tenants", tenantsRouter);
  admin.use("/leases", leasesRouter);
  admin.use("/invoices", invoicesRouter);
  admin.use("/payments", paymentsRouter);
  admin.use("/meter-readings", meterReadingsRouter);
  admin.use("/reports", reportsRouter);
  admin.use("/settings", settingsRouter);
  admin.use("/", documentsRouter);
  api.use(admin);

  app.use("/api", api);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

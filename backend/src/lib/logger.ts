import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { service: "stms-api" },
  redact: ["req.headers.cookie", "req.headers.authorization", "*.password", "*.passwordHash"],
});

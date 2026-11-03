import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import multer from "multer";
import { HttpError } from "../lib/http.js";
import { logger } from "../lib/logger.js";

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: "Not found" });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  if (err instanceof multer.MulterError) {
    const msg = err.code === "LIMIT_FILE_SIZE" ? "File is too large" : err.message;
    return res.status(400).json({ error: msg });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      const target = (err.meta?.target as string[] | undefined)?.join(", ");
      return res.status(409).json({ error: `A record with this ${target ?? "value"} already exists` });
    }
    if (err.code === "P2025") return res.status(404).json({ error: "Record not found" });
    if (err.code === "P2003") return res.status(409).json({ error: "This record is still referenced by other data" });
  }
  logger.error({ err, reqId: req.id }, "Unhandled error");
  res.status(500).json({ error: "Something went wrong", requestId: req.id });
}

import { randomUUID } from "node:crypto";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { DocumentType } from "@prisma/client";
import { z } from "zod";
import { audit } from "../../lib/audit.js";
import { badRequest, notFound, param, parse } from "../../lib/http.js";
import { prisma } from "../../lib/prisma.js";
import { deleteObject, localStream, putObject, signedUrl } from "../../lib/storage.js";

export const documentsRouter = Router();

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const RULES: Record<DocumentType, { mimes: string[]; maxMb: number; single: boolean }> = {
  PHOTO: { mimes: IMAGE_TYPES, maxMb: 2, single: true },
  LEASE_FORM: { mimes: ["application/pdf"], maxMb: 10, single: true },
  POLICE_VERIFICATION: { mimes: ["application/pdf"], maxMb: 10, single: true },
  NID_COPY: { mimes: [...IMAGE_TYPES, "application/pdf"], maxMb: 5, single: false },
  OTHER: { mimes: [...IMAGE_TYPES, "application/pdf"], maxMb: 10, single: false },
};

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });

/** Check file signatures so a renamed .exe can't pass as a PDF. */
function sniff(buf: Buffer): string | null {
  if (buf.subarray(0, 5).toString() === "%PDF-") return "application/pdf";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "image/webp";
  return null;
}

const EXT: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

documentsRouter.post("/tenants/:tenantId/documents", upload.single("file"), async (req, res) => {
  const tenantId = param(req, "tenantId");
  const { type } = parse(z.object({ type: z.nativeEnum(DocumentType) }), req.body);
  const file = req.file;
  if (!file) throw badRequest("No file uploaded");

  const rule = RULES[type];
  const mime = sniff(file.buffer);
  if (!mime || !rule.mimes.includes(mime)) {
    throw badRequest(`Unsupported file type for ${type}. Allowed: ${rule.mimes.join(", ")}`);
  }
  if (file.size > rule.maxMb * 1024 * 1024) throw badRequest(`File must be ${rule.maxMb} MB or smaller`);

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
  if (!tenant) throw notFound("Tenant");

  const key = `tenants/${tenantId}/${type.toLowerCase()}/${randomUUID()}${EXT[mime]}`;
  await putObject(key, file.buffer, mime);

  const doc = await prisma.$transaction(async (tx) => {
    if (rule.single) {
      await tx.document.updateMany({
        where: { tenantId, type, supersededAt: null },
        data: { supersededAt: new Date() },
      });
    }
    return tx.document.create({
      data: {
        tenantId,
        type,
        storageKey: key,
        fileName: path.basename(file.originalname).slice(0, 200) || `${type.toLowerCase()}${EXT[mime]}`,
        mimeType: mime,
        size: file.size,
      },
    });
  });
  await audit(req.user?.id, "upload", "Document", doc.id, { tenantId, type });
  res.status(201).json(doc);
});

documentsRouter.get("/tenants/:tenantId/documents", async (req, res) => {
  const tenantId = param(req, "tenantId");
  const docs = await prisma.document.findMany({
    where: { tenantId },
    orderBy: [{ supersededAt: { sort: "asc", nulls: "first" } }, { uploadedAt: "desc" }],
  });
  res.json({ items: docs });
});

/** View/download a file: redirects to a short-lived S3 URL, or streams it from local disk. */
documentsRouter.get("/documents/:id/file", async (req, res) => {
  const doc = await prisma.document.findUnique({ where: { id: param(req, "id") } });
  if (!doc) throw notFound("Document");
  const download = req.query.download === "1";
  const url = await signedUrl(doc.storageKey, doc.fileName, !download);
  if (url) return res.redirect(302, url);

  res.setHeader("Content-Type", doc.mimeType);
  res.setHeader("Cache-Control", "private, max-age=300");
  res.setHeader(
    "Content-Disposition",
    `${download ? "attachment" : "inline"}; filename="${doc.fileName.replace(/"/g, "")}"`,
  );
  localStream(doc.storageKey)
    .on("error", () => res.status(404).end())
    .pipe(res);
});

documentsRouter.delete("/documents/:id", async (req, res) => {
  const doc = await prisma.document.findUnique({ where: { id: param(req, "id") } });
  if (!doc) throw notFound("Document");
  await prisma.document.delete({ where: { id: doc.id } });
  await deleteObject(doc.storageKey);
  await audit(req.user?.id, "delete", "Document", doc.id, { tenantId: doc.tenantId, type: doc.type });
  res.status(204).end();
});

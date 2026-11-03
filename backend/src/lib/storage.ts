import { createReadStream } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "../config.js";

/**
 * File storage. Uses S3 when S3_BUCKET is set, otherwise the local disk (UPLOAD_DIR).
 * Callers only see storage keys, so switching backends needs no code changes.
 */
export const usingS3 = Boolean(config.S3_BUCKET);

const s3 = usingS3
  ? new S3Client({
      region: config.S3_REGION,
      endpoint: config.S3_ENDPOINT || undefined,
      forcePathStyle: config.S3_FORCE_PATH_STYLE,
      credentials:
        config.S3_ACCESS_KEY_ID && config.S3_SECRET_ACCESS_KEY
          ? { accessKeyId: config.S3_ACCESS_KEY_ID, secretAccessKey: config.S3_SECRET_ACCESS_KEY }
          : undefined,
    })
  : null;

const localPath = (key: string) => {
  const root = path.resolve(config.UPLOAD_DIR);
  const full = path.resolve(root, key);
  if (!full.startsWith(root + path.sep)) throw new Error("Invalid storage key");
  return full;
};

export async function putObject(key: string, data: Buffer, contentType: string) {
  if (s3) {
    await s3.send(
      new PutObjectCommand({
        Bucket: config.S3_BUCKET,
        Key: key,
        Body: data,
        ContentType: contentType,
        ServerSideEncryption: config.S3_ENDPOINT ? undefined : "AES256",
      }),
    );
    return;
  }
  const file = localPath(key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, data);
}

export async function deleteObject(key: string) {
  if (s3) {
    await s3.send(new DeleteObjectCommand({ Bucket: config.S3_BUCKET, Key: key }));
    return;
  }
  await unlink(localPath(key)).catch(() => undefined);
}

/** Short-lived signed URL (S3 only). */
export async function signedUrl(key: string, fileName: string, inline = true, expiresIn = 600) {
  if (!s3) return null;
  const disposition = `${inline ? "inline" : "attachment"}; filename="${fileName.replace(/"/g, "")}"`;
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: config.S3_BUCKET, Key: key, ResponseContentDisposition: disposition }),
    { expiresIn },
  );
}

export function localStream(key: string): Readable {
  return createReadStream(localPath(key));
}

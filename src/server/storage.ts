import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";

/**
 * Private file storage for chat attachments. Files are only ever served
 * through /api/files/[id], which checks the viewer's access every time.
 *
 * Local disk in development. For production swap this module for Google
 * Cloud Storage / S3 (same two functions) — files must never be public.
 */
const root = () => resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.STORAGE_DIR || "./storage");

export async function putObject(data: Buffer, ext: string) {
  const now = new Date();
  const key = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}${ext}`;
  const path = join(/*turbopackIgnore: true*/ root(), key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, data);
  return key;
}

export async function getObject(key: string) {
  const base = root();
  const path = resolve(/*turbopackIgnore: true*/ base, key);
  if (!path.startsWith(base + sep)) throw new Error("Invalid storage key");
  return readFile(path);
}

export const ALLOWED_UPLOADS: Record<string, { mime: string; inline: boolean }> = {
  ".jpg": { mime: "image/jpeg", inline: true },
  ".jpeg": { mime: "image/jpeg", inline: true },
  ".png": { mime: "image/png", inline: true },
  ".webp": { mime: "image/webp", inline: true },
  ".heic": { mime: "image/heic", inline: false },
  ".pdf": { mime: "application/pdf", inline: true },
  ".doc": { mime: "application/msword", inline: false },
  ".docx": { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", inline: false },
  ".ppt": { mime: "application/vnd.ms-powerpoint", inline: false },
  ".pptx": { mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", inline: false },
  ".xls": { mime: "application/vnd.ms-excel", inline: false },
  ".xlsx": { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", inline: false },
  ".txt": { mime: "text/plain", inline: false },
};

/** Cheap content sniffing so a renamed executable can't pass as a PDF/image. */
export function contentMatchesExtension(buf: Buffer, ext: string) {
  const starts = (...bytes: number[]) => bytes.every((b, i) => buf[i] === b);
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return starts(0xff, 0xd8, 0xff);
    case ".png":
      return starts(0x89, 0x50, 0x4e, 0x47);
    case ".webp":
      return buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP";
    case ".heic":
      return buf.subarray(4, 8).toString() === "ftyp";
    case ".pdf":
      return buf.subarray(0, 5).toString() === "%PDF-";
    case ".docx":
    case ".pptx":
    case ".xlsx":
      return starts(0x50, 0x4b, 0x03, 0x04); // zip container
    case ".doc":
    case ".ppt":
    case ".xls":
      return starts(0xd0, 0xcf, 0x11, 0xe0); // OLE compound file
    case ".txt":
      return !buf.subarray(0, 4096).includes(0);
    default:
      return false;
  }
}

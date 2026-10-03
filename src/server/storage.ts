import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { AwsClient } from "aws4fetch";

/**
 * Private file storage for chat attachments. Files are only ever served
 * through /api/files/[id], which checks the viewer's access every time.
 *
 * STORAGE_DRIVER="local" (default) keeps files on disk under STORAGE_DIR, for development.
 * STORAGE_DRIVER="r2" keeps them in a private Cloudflare R2 bucket, for production, so
 * the server holds no files and can be resized or replaced freely.
 */
interface Driver {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  list(prefix: string): Promise<string[]>;
}

const localDriver = (): Driver => {
  const base = resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.STORAGE_DIR || "./storage");
  const pathFor = (key: string) => {
    const path = resolve(/*turbopackIgnore: true*/ base, key);
    if (!path.startsWith(base + sep)) throw new Error("Invalid storage key");
    return path;
  };
  return {
    async put(key, data) {
      const path = pathFor(key);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, data);
    },
    get: (key) => readFile(pathFor(key)),
    async list(prefix) {
      const files = await readdir(base, { recursive: true }).catch(() => [] as string[]);
      return files.map((f) => f.split(sep).join("/")).filter((k) => k.startsWith(prefix));
    },
  };
};

export function r2Driver(env: NodeJS.ProcessEnv = process.env): Driver {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
    throw new Error("STORAGE_DRIVER=r2 needs R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET");
  }
  const client = new AwsClient({
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    service: "s3",
    region: "auto",
  });
  const urlFor = (key: string) => {
    if (!/^[\w./-]+$/.test(key) || key.split("/").includes("..")) throw new Error("Invalid storage key");
    return `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${key}`;
  };
  return {
    async put(key, data, contentType) {
      const res = await client.fetch(urlFor(key), {
        method: "PUT",
        body: new Uint8Array(data),
        headers: { "Content-Type": contentType },
      });
      if (!res.ok) throw new Error(`R2 upload failed (${res.status}): ${await res.text()}`);
    },
    async get(key) {
      const res = await client.fetch(urlFor(key));
      if (!res.ok) throw new Error(`R2 download failed (${res.status}) for ${key}`);
      return Buffer.from(await res.arrayBuffer());
    },
    async list(prefix) {
      const keys: string[] = [];
      let token: string | undefined;
      do {
        const q = new URLSearchParams({ "list-type": "2", prefix, ...(token ? { "continuation-token": token } : {}) });
        const res = await client.fetch(`https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}?${q}`);
        if (!res.ok) throw new Error(`R2 list failed (${res.status})`);
        const xml = await res.text();
        keys.push(...[...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) => m[1]));
        token = xml.includes("<IsTruncated>true</IsTruncated>") ? xml.match(/<NextContinuationToken>([^<]+)</)?.[1] : undefined;
      } while (token);
      return keys;
    },
  };
}

let driver: Driver | undefined;
const storage = () => (driver ??= process.env.STORAGE_DRIVER === "r2" ? r2Driver() : localDriver());

export async function putObject(data: Buffer, ext: string) {
  const now = new Date();
  const key = `uploads/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}${ext}`;
  await storage().put(key, data, ALLOWED_UPLOADS[ext]?.mime ?? "application/octet-stream");
  return key;
}

export function getObject(key: string) {
  return storage().get(key);
}

export function listObjects(prefix: string) {
  return storage().list(prefix);
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

import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";

// Private file storage foundation (CTL-06): uploaded files are never reachable
// by a static URL. The only way to read one back is through /api/files/[id],
// which checks the caller's permission and writes an audit event before
// streaming bytes. There is no long-lived signed URL — every request
// re-checks the current session.
//
// Bytes live in the database (FileBlob, keyed by storageKey) because the app
// runs on Vercel, whose disk is read-only: a local folder cannot hold uploads
// there. Files saved to disk by earlier local runs are still readable (the
// disk is only a read fallback, never written to).
const LEGACY_DISK_ROOT = process.env.PRIVATE_FILE_STORAGE_ROOT ?? "./storage/private";

function resolveLegacyPath(storageKey: string): string {
  const resolvedRoot = path.resolve(process.cwd(), LEGACY_DISK_ROOT);
  const resolvedPath = path.resolve(resolvedRoot, storageKey);
  if (!resolvedPath.startsWith(resolvedRoot)) {
    throw new Error("Invalid storage key: path traversal detected");
  }
  return resolvedPath;
}

export async function savePrivateFile(storageKey: string, data: Buffer): Promise<void> {
  await prisma.fileBlob.create({ data: { storageKey, data: new Uint8Array(data) } });
}

// Returns null when no bytes exist for the key.
export async function readPrivateFile(storageKey: string): Promise<Buffer | null> {
  const blob = await prisma.fileBlob.findUnique({ where: { storageKey }, select: { data: true } });
  if (blob) return Buffer.from(blob.data);
  try {
    return await fs.readFile(resolveLegacyPath(storageKey));
  } catch {
    return null;
  }
}

// CTL-12: "use randomized storage keys" — the key must never be derivable from
// the original filename or any guessable sequence, since the storage key isn't
// secret-checked on its own (permission is enforced by the /api/files/[id]
// route, not by obscurity), but a predictable key would still make it trivially
// easy to enumerate other employees' documents.
export function randomStorageKey(category: string, extension: string): string {
  const safeCategory = category.toLowerCase().replace(/[^a-z0-9]/g, "-");
  return `${safeCategory}/${randomUUID()}${extension}`;
}

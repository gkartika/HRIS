import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

// Private file storage foundation (CTL-06): files live outside public/ and are
// never reachable by a static URL. The only way to read one back is through
// /api/files/[id], which checks the caller's permission and writes an audit
// event before streaming bytes. There is no long-lived signed URL — every
// request re-checks the current session.
const STORAGE_ROOT = process.env.PRIVATE_FILE_STORAGE_ROOT ?? "./storage/private";

function resolveStoragePath(storageKey: string): string {
  const resolvedRoot = path.resolve(process.cwd(), STORAGE_ROOT);
  const resolvedPath = path.resolve(resolvedRoot, storageKey);
  if (!resolvedPath.startsWith(resolvedRoot)) {
    throw new Error("Invalid storage key: path traversal detected");
  }
  return resolvedPath;
}

export async function savePrivateFile(storageKey: string, data: Buffer): Promise<void> {
  const filePath = resolveStoragePath(storageKey);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, data);
}

export async function readPrivateFile(storageKey: string): Promise<Buffer> {
  return fs.readFile(resolveStoragePath(storageKey));
}

// CTL-12: "use randomized storage keys" — the on-disk name must never be
// derivable from the original filename or any guessable sequence, since the
// storage key isn't secret-checked on its own (permission is enforced by the
// /api/files/[id] route, not by obscurity), but a predictable key would still
// make it trivially easy to enumerate other employees' documents on disk.
export function randomStorageKey(category: string, extension: string): string {
  const safeCategory = category.toLowerCase().replace(/[^a-z0-9]/g, "-");
  return `${safeCategory}/${randomUUID()}${extension}`;
}

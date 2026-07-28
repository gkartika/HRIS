import { promises as fs } from "fs";
import path from "path";

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

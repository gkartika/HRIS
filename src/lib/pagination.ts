export const PAGE_SIZE = 50;

// ?page=N -> { page, skip, take } for a Prisma findMany (1-based, never < 1).
export function pageParams(raw: string | undefined, size: number = PAGE_SIZE) {
  const page = Math.max(1, Math.floor(Number(raw)) || 1);
  return { page, skip: (page - 1) * size, take: size, size };
}

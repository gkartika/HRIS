import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveSession } from "@/lib/require-session";
import { readPrivateFile } from "@/lib/file-storage";
import { safeFileName } from "@/lib/evaluation-guideline";

// The PDF guideline of the evaluation matrix. Any signed-in person may open it (it is the company's standard, not
// anyone's data); nobody without a login can.
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getActiveSession();
  if (!session?.user) return new NextResponse("Silakan masuk dulu.", { status: 401 });

  const setting = await prisma.evaluationSetting.findUnique({
    where: { id: "default" },
    select: { guidelineFile: { select: { storageKey: true, originalFileName: true } } },
  });
  const file = setting?.guidelineFile;
  if (!file) return new NextResponse("Pedoman belum diunggah.", { status: 404 });

  const bytes = await readPrivateFile(file.storageKey);
  if (!bytes) return new NextResponse("File pedoman tidak ditemukan.", { status: 404 });

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${safeFileName(file.originalFileName)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

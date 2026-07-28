import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isHrAdmin } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { buildEmployeeDocumentsZip } from "@/lib/import-export/employee-documents-zip";

// CTL-13: authorized ZIP export with manifest for file-bearing records.
// HR Admin only — these are the same highly-restricted employee documents
// (KTP/KK/contracts/etc.) gated everywhere else in the app.
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isHrAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const zipBuffer = await buildEmployeeDocumentsZip();

  await logAudit({
    actorAccountId: session.user.id,
    action: "EXPORT",
    datasetName: "FileObject (ZIP)",
    reason: "Exported employee documents ZIP with manifest",
  });

  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="employee-documents-${new Date().toISOString().slice(0, 10)}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}

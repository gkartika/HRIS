import { NextResponse } from "next/server";
import { readPrivateFile } from "@/lib/file-storage";
import { findOfferByToken, offerIsOpen } from "@/lib/recruitment-flow";

// The offering letter PDF for the applicant who holds the private link. No sign-in: the
// one-time token is the key, and it stops working when the link is replaced, expires, or
// the applicant leaves the pipeline.
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const offer = await findOfferByToken(token);
  if (!offer || !(offer.response || offerIsOpen(offer))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const bytes = await readPrivateFile(offer.file.storageKey);
  if (!bytes) return NextResponse.json({ error: "Berkas tidak ditemukan." }, { status: 404 });
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Surat-Penawaran.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

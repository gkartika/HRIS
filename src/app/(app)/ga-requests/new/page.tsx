import { redirect } from "next/navigation";

// Requests are sent from Perlengkapan Saya now: the Permintaan Aset button, and Lapor Rusak and
// Lapor Hilang on each held asset. This address only keeps old bookmarks working.
export default function NewGaRequestPage() {
  redirect("/my-assets");
}

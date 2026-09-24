import { COMPANY_TIME_ZONE } from "@/lib/company-time";

// Date display shared by every screen: Indonesian, company timezone, and "—"
// for an empty value. (Was copy-pasted as a local formatDate() in 17 pages.)
const long = new Intl.DateTimeFormat("id-ID", { timeZone: COMPANY_TIME_ZONE, dateStyle: "long" });
const medium = new Intl.DateTimeFormat("id-ID", { timeZone: COMPANY_TIME_ZONE, dateStyle: "medium" });

export function formatDateLong(date: Date | null | undefined): string {
  return date ? long.format(new Date(date)) : "—";
}

export function formatDateMedium(date: Date | null | undefined): string {
  return date ? medium.format(new Date(date)) : "—";
}

import { companyDateParts } from "@/lib/company-time";
import { t } from "@/lib/i18n/id";

// The greeting the login mascot (and the phone header) uses, by company (WIB) time of day:
// 04:00-10:59 pagi, 11:00-14:59 siang, 15:00-17:59 sore, 18:00-03:59 malam.
export type PartOfDay = "pagi" | "siang" | "sore" | "malam";

export function partOfDay(hour: number): PartOfDay {
  if (hour >= 4 && hour < 11) return "pagi";
  if (hour >= 11 && hour < 15) return "siang";
  if (hour >= 15 && hour < 18) return "sore";
  return "malam";
}

export function currentPartOfDay(now: Date = new Date()): PartOfDay {
  return partOfDay(companyDateParts(now).hour);
}

// "Selamat pagi" ...
export function greetingFor(part: PartOfDay): string {
  return t(`auth.greeting.${part}`);
}

// Fills "{sapaan}" in a mascot line. Before the time is known (server render) the greeting is simply left
// out, so the line still reads naturally ("Halo! Yuk, masuk dulu ya.").
export function fillGreeting(template: string, greeting: string | null): string {
  if (greeting) return template.replace("{sapaan}", greeting);
  return template.replace(/\{sapaan\}\.?\s*/, "").replace(/^([a-z])/, (c) => c.toUpperCase());
}

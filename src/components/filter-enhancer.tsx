"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { t } from "@/lib/i18n/id";

// Turns every list-page filter form (a GET form whose submit button reads
// "Terapkan Filter") into a live one: changing a dropdown or date applies at
// once, typing in a search box applies after a short pause, and the filters
// currently in effect are shown as removable chips under the form. Pages keep
// their plain server-rendered forms — with JS off, the button still works.
const APPLY_LABEL = t("common.applyFilter");
const CHIPS_ATTR = "data-filter-chips";

function isFilterForm(form: Element | null): form is HTMLFormElement {
  if (!(form instanceof HTMLFormElement)) return false;
  return Array.from(form.querySelectorAll('button[type="submit"]')).some((b) => b.textContent?.trim() === APPLY_LABEL);
}

function controlLabel(el: HTMLElement): string {
  const label = el.closest("div")?.querySelector("label")?.textContent?.trim();
  return label ?? "";
}

export function FilterEnhancer() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams().toString();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const apply = (form: HTMLFormElement) => {
      const params = new URLSearchParams();
      new FormData(form).forEach((value, key) => {
        if (typeof value === "string" && value !== "") params.append(key, value);
      });
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    };

    const onChange = (e: Event) => {
      const target = e.target as HTMLElement;
      const form = target.closest("form");
      if (!isFilterForm(form)) return;
      if (target instanceof HTMLInputElement && (target.type === "text" || target.type === "search")) return;
      apply(form);
    };
    const onInput = (e: Event) => {
      const target = e.target as HTMLElement;
      const form = target.closest("form");
      if (!isFilterForm(form)) return;
      if (!(target instanceof HTMLInputElement) || (target.type !== "text" && target.type !== "search")) return;
      clearTimeout(timer);
      timer = setTimeout(() => apply(form), 450);
    };
    const onSubmit = (e: Event) => {
      const form = e.target as HTMLElement;
      if (!isFilterForm(form)) return;
      e.preventDefault();
      clearTimeout(timer);
      apply(form);
    };

    document.addEventListener("change", onChange);
    document.addEventListener("input", onInput);
    document.addEventListener("submit", onSubmit);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("change", onChange);
      document.removeEventListener("input", onInput);
      document.removeEventListener("submit", onSubmit);
    };
  }, [router, pathname]);

  // Hide the now-redundant apply button and (re)draw the active-filter chips.
  useEffect(() => {
    document.querySelectorAll(`[${CHIPS_ATTR}]`).forEach((n) => n.remove());
    document.querySelectorAll("main form").forEach((form) => {
      if (!isFilterForm(form)) return;
      form.setAttribute("data-autofilter", "");

      const chips: { text: string; el: HTMLInputElement | HTMLSelectElement }[] = [];
      form.querySelectorAll<HTMLInputElement | HTMLSelectElement>("select[name], input[name]").forEach((el) => {
        if (el instanceof HTMLInputElement && (el.type === "hidden" || el.type === "submit")) return;
        if (!el.value) return;
        const shown = el instanceof HTMLSelectElement ? el.selectedOptions[0]?.textContent?.trim() : el.value;
        const label = controlLabel(el);
        chips.push({ text: label ? `${label}: ${shown}` : `${shown}`, el });
      });
      if (chips.length === 0) return;

      const wrap = document.createElement("div");
      wrap.setAttribute(CHIPS_ATTR, "");
      wrap.className = "mb-4 flex flex-wrap items-center gap-2";
      const clearAndApply = (els: (HTMLInputElement | HTMLSelectElement)[]) => {
        els.forEach((el) => {
          el.value = "";
        });
        (form as HTMLFormElement).requestSubmit();
      };
      chips.forEach((c) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className =
          "inline-flex items-center gap-1.5 rounded-full bg-indigo-50 py-1 pr-2 pl-3 text-xs font-medium text-indigo-700 hover:bg-indigo-100";
        btn.setAttribute("aria-label", `Hapus filter ${c.text}`);
        btn.append(document.createTextNode(c.text));
        const x = document.createElement("span");
        x.textContent = "×";
        x.setAttribute("aria-hidden", "true");
        x.className = "text-sm leading-none";
        btn.append(x);
        btn.addEventListener("click", () => clearAndApply([c.el]));
        wrap.append(btn);
      });
      if (chips.length > 1) {
        const all = document.createElement("button");
        all.type = "button";
        all.className = "px-2 py-1 text-xs text-slate-500 hover:text-slate-800";
        all.textContent = "Hapus semua";
        all.addEventListener("click", () => clearAndApply(chips.map((c) => c.el)));
        wrap.append(all);
      }
      form.insertAdjacentElement("afterend", wrap);
    });
  }, [pathname, search]);

  return null;
}

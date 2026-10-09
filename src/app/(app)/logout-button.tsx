"use client";

import { LogOut } from "lucide-react";
import { logoutAction } from "./actions";
import { t } from "@/lib/i18n/id";
import { clearAppBadge } from "@/lib/app-badge";

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        onClick={() => void clearAppBadge()}
        className="mt-3 flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800"
      >
        <LogOut size={13} />
        {t("auth.logoutButton")}
      </button>
    </form>
  );
}

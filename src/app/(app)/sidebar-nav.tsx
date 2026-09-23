"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronRight,
  LayoutDashboard,
  Users,
  Upload,
  ShieldCheck,
  UserCircle,
  Building2,
  Settings,
  FileText,
  Briefcase,
  Inbox,
  BarChart3,
  ArrowLeftRight,
  ClipboardCheck,
  ListChecks,
  FileSignature,
  UserMinus,
  CalendarClock,
  CalendarOff,
  GraduationCap,
  Package,
  Wrench,
  Trash2,
  TrendingDown,
  type LucideIcon,
} from "lucide-react";

// Server Components can't pass a component/function reference (the icon
// itself) as a prop to a Client Component — only serializable data crosses
// that boundary. layout.tsx (server) sends the icon's NAME as a plain
// string instead, resolved to the real component here on the client side.
const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  Users,
  Upload,
  ShieldCheck,
  UserCircle,
  Building2,
  Settings,
  FileText,
  Briefcase,
  Inbox,
  BarChart3,
  ArrowLeftRight,
  ClipboardCheck,
  ListChecks,
  FileSignature,
  UserMinus,
  CalendarClock,
  CalendarOff,
  GraduationCap,
  Package,
  Wrench,
  Trash2,
  TrendingDown,
};

export interface SidebarNavItem {
  href: string;
  label: string;
  icon: string;
}

export interface SidebarNavGroup {
  key: string;
  label: string;
  items: SidebarNavItem[];
}

// Categorized sidebar: replaces one long flat list of ~25-30 links with 8
// collapsible groups (plus Beranda/Perlu Persetujuan pinned above them) so a
// role with many capabilities doesn't overwhelm a role with few — a group
// with zero visible items for this session is simply never rendered at all
// (decided by the server in layout.tsx before this component ever sees it),
// so a plain employee naturally gets a short sidebar with no extra logic
// here. Only the expand/collapse state is client-side; the permission-
// filtered item list itself always comes from the server.
export function SidebarNav({
  topItems,
  groups,
  bottomItems,
}: {
  topItems: SidebarNavItem[];
  groups: SidebarNavGroup[];
  bottomItems: SidebarNavItem[];
}) {
  const pathname = usePathname();

  const groupContainingActive = groups.find((g) => g.items.some((it) => pathname.startsWith(it.href)));
  const [openGroup, setOpenGroup] = useState<string | null>(groupContainingActive?.key ?? groups[0]?.key ?? null);

  return (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3.5">
      {topItems.map((item) => {
        const Icon = ICONS[item.icon];
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold ${
              active ? "bg-brand-accent text-brand" : "text-white/90 hover:bg-white/10"
            }`}
          >
            <Icon size={17} />
            {item.label}
          </Link>
        );
      })}

      {topItems.length > 0 && groups.length > 0 && <div className="h-3" />}

      {groups.map((group) => {
        const isOpen = openGroup === group.key;
        return (
          <div key={group.key}>
            <button
              type="button"
              onClick={() => setOpenGroup(isOpen ? null : group.key)}
              className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide text-white/55 hover:text-white/80"
            >
              {group.label}
              <ChevronRight size={13} className={`transition-transform ${isOpen ? "rotate-90" : ""}`} />
            </button>
            {isOpen && (
              <div className="flex flex-col gap-0.5 py-0.5">
                {group.items.map((item) => {
                  const Icon = ICONS[item.icon];
                  const active = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2.5 rounded-lg py-2 pl-7 pr-3 text-sm ${
                        active ? "bg-brand-accent font-semibold text-brand" : "text-white/80 hover:bg-white/10"
                      }`}
                    >
                      <Icon size={15} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {bottomItems.length > 0 && <div className="h-2" />}
      {bottomItems.map((item) => {
        const Icon = ICONS[item.icon];
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium ${
              active ? "bg-brand-accent text-brand" : "text-white/75 hover:bg-white/10"
            }`}
          >
            <Icon size={17} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, MapPin, Users, History, CalendarClock, KanbanSquare, Compass, ClipboardCheck, Sparkles, Wallet } from "lucide-react";

const ICONS = {
  LayoutDashboard,
  MapPin,
  Users,
  History,
  CalendarClock,
  KanbanSquare,
  Compass,
  ClipboardCheck,
  Sparkles,
  Wallet,
} as const;

export interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  badge?: number;
}

export function NavLinks({ items, orientation = "vertical" }: { items: NavItem[]; orientation?: "vertical" | "horizontal" | "bottom" }) {
  const pathname = usePathname();

  return (
    <nav
      className={cn("flex flex-1 gap-1", orientation === "vertical" ? "flex-col" : "flex-row", orientation === "bottom" && "justify-around")}
      aria-label="Navegação principal"
    >
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors",
              orientation === "bottom" && "relative min-h-12 min-w-14 flex-col justify-center gap-0.5 px-1 py-1 text-[10px]",
              active
                ? "bg-accent-soft text-accent-2"
                : "text-muted hover:bg-surface-2 hover:text-foreground"
            )}
          >
            <Icon className={cn("h-4 w-4 shrink-0", orientation === "bottom" && "h-5 w-5")} />
            <span className={orientation === "vertical" ? "flex-1" : ""}>{item.label}</span>
            {!!item.badge && (
              <span className={cn("rounded-full bg-danger/20 px-1.5 py-0.5 text-[11px] font-medium leading-none text-danger", orientation === "bottom" && "absolute right-1 top-0.5")}>
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

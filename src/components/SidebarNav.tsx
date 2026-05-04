"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import clsx from "clsx";

const ITEMS = [
  { href: "/times", label: "Times" },
  { href: "/roi", label: "Custo por Time" },
  { href: "/canais", label: "Canais" },
  { href: "/longos", label: "Longos" },
  { href: "/shorts", label: "Shorts" },
  { href: "/relatorio", label: "Relatório" },
];

export function SidebarNav() {
  const pathname = usePathname();
  const search = useSearchParams();
  // Carry period params between sections but reset entity selection to "Todos"
  const carried = new URLSearchParams();
  for (const key of ["preset", "start", "end"]) {
    const v = search.get(key);
    if (v) carried.set(key, v);
  }
  const qs = carried.toString();
  const suffix = qs ? `?${qs}` : "";
  return (
    <nav className="flex flex-col gap-1">
      {ITEMS.map((item) => {
        const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={`${item.href}${suffix}`}
            className={clsx(
              "rounded-lg px-3 py-2 text-sm transition-colors",
              active
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

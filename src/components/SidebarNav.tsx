"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { useAuth } from "@/context/AuthContext";

const ITEMS = [
  { href: "/times", label: "Times" },
  { href: "/roi", label: "Custo por Time" },
  { href: "/canais", label: "Canais" },
  { href: "/longos", label: "Longos" },
  { href: "/shorts", label: "Shorts" },
  { href: "/traducoes", label: "Traduções" },
  { href: "/relatorio", label: "Relatório" },
];

export function SidebarNav() {
  const pathname = usePathname();
  const search = useSearchParams();
  const { isAdmin } = useAuth();
  // Carry period params between sections but reset entity selection to "Todos"
  const carried = new URLSearchParams();
  for (const key of ["preset", "start", "end"]) {
    const v = search.get(key);
    if (v) carried.set(key, v);
  }
  const qs = carried.toString();
  const suffix = qs ? `?${qs}` : "";

  function NavLink({ href, label, exact = false }: { href: string; label: string; exact?: boolean }) {
    const active = exact ? pathname === href : pathname === href || pathname?.startsWith(`${href}/`);
    return (
      <Link
        href={href}
        className={clsx(
          "rounded-lg px-3 py-2 text-sm transition-colors",
          active
            ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
            : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
        )}
      >
        {label}
      </Link>
    );
  }

  const visibleItems = isAdmin ? ITEMS : ITEMS.filter((i) => i.href === "/times");

  return (
    <nav className="flex flex-col gap-1">
      {visibleItems.map((item) => (
        <NavLink key={item.href} href={`${item.href}${suffix}`} label={item.label} />
      ))}
      {isAdmin && (
        <>
          <div className="my-1 border-t border-zinc-200 dark:border-zinc-800" />
          <NavLink href="/admin" label="Usuários" exact />
        </>
      )}
    </nav>
  );
}

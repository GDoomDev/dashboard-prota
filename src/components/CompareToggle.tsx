"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import clsx from "clsx";

export function CompareToggle({ entityLabel }: { entityLabel: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const enabled = params.get("compare") === "1";

  function toggle() {
    const next = new URLSearchParams(params.toString());
    if (enabled) next.delete("compare");
    else next.set("compare", "1");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  return (
    <button
      onClick={toggle}
      className={clsx(
        "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors",
        enabled
          ? "border-indigo-500 bg-indigo-500 text-white"
          : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800",
      )}
    >
      <span
        className={clsx(
          "inline-block h-2 w-2 rounded-full",
          enabled ? "bg-white" : "bg-zinc-400",
        )}
      />
      Comparar {entityLabel}
    </button>
  );
}

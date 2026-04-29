"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import clsx from "clsx";

interface Entity {
  id: string;
  label: string;
}

interface Props {
  entities: Entity[];
  selected?: string;
  hideTodos?: boolean;
}

export function EntityPicker({ entities, selected, hideTodos }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  if (entities.length <= 1) return null;

  function select(id: string | null) {
    const next = new URLSearchParams(params.toString());
    if (id === null) next.delete("entity");
    else next.set("entity", id);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const pill =
    "rounded-full border px-3 py-1 text-sm font-medium transition-colors whitespace-nowrap";
  const active =
    "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900";
  const inactive =
    "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800";

  return (
    <div className="flex flex-wrap gap-2">
      {!hideTodos && (
        <button
          onClick={() => select(null)}
          className={clsx(pill, !selected ? active : inactive)}
        >
          Todos
        </button>
      )}
      {entities.map((e) => (
        <button
          key={e.id}
          onClick={() => select(e.id)}
          className={clsx(pill, selected === e.id ? active : inactive)}
        >
          {e.label}
        </button>
      ))}
    </div>
  );
}

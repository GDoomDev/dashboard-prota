"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import clsx from "clsx";

type SimplePreset = "7d" | "30d" | "90d" | "tri" | "2026";

const PRESETS: Array<{ id: SimplePreset; label: string }> = [
  { id: "7d", label: "7 dias" },
  { id: "30d", label: "30 dias" },
  { id: "90d", label: "90 dias" },
  { id: "tri", label: "Tri" },
  { id: "2026", label: "2026" },
];

interface Props {
  defaultPreset?: SimplePreset;
}

export function PeriodPicker({ defaultPreset = "30d" }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("preset") ?? defaultPreset;
  const customStart = params.get("start") ?? "";
  const customEnd = params.get("end") ?? "";
  const [showCustom, setShowCustom] = useState(current === "custom");
  const [start, setStart] = useState(customStart);
  const [end, setEnd] = useState(customEnd);

  useEffect(() => {
    setShowCustom(current === "custom");
    setStart(customStart);
    setEnd(customEnd);
  }, [current, customStart, customEnd]);

  function update(next: URLSearchParams) {
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  function setPreset(preset: SimplePreset) {
    const next = new URLSearchParams(params.toString());
    next.set("preset", preset);
    next.delete("start");
    next.delete("end");
    setShowCustom(false);
    update(next);
  }

  function applyCustom() {
    if (!start || !end) return;
    const next = new URLSearchParams(params.toString());
    next.set("preset", "custom");
    next.set("start", start);
    next.set("end", end);
    update(next);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-lg border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPreset(p.id)}
            className={clsx(
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              current === p.id
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
            )}
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={() => setShowCustom((v) => !v)}
          className={clsx(
            "rounded-md px-3 py-1.5 text-sm transition-colors",
            current === "custom"
              ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
              : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
          )}
        >
          Personalizado
        </button>
      </div>
      {showCustom && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-800 dark:bg-zinc-900"
          />
          <span className="text-zinc-400">→</span>
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-800 dark:bg-zinc-900"
          />
          <button
            onClick={applyCustom}
            disabled={!start || !end}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white disabled:opacity-40"
          >
            Aplicar
          </button>
        </div>
      )}
    </div>
  );
}

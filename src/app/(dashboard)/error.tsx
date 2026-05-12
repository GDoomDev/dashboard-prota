"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="rounded-xl border border-red-300 bg-red-50 p-6 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
      <h2 className="text-lg font-semibold">Erro ao carregar dados</h2>
      <p className="mt-1 text-sm">{error.message}</p>
      <button
        onClick={reset}
        className="mt-4 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
      >
        Tentar novamente
      </button>
    </div>
  );
}

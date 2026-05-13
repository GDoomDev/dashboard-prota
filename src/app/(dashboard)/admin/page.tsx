"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getAllWhitelistEntries, bulkAddUsers, WhitelistEntry, isAdminEntry } from "@/lib/whitelist";

export default function AdminPage() {
  const { isAdmin, loading } = useAuth();
  const [users, setUsers] = useState<WhitelistEntry[]>([]);
  const [fetching, setFetching] = useState(true);
  const [textarea, setTextarea] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ added: string[]; skipped: string[] } | null>(null);

  async function loadUsers() {
    setFetching(true);
    const entries = await getAllWhitelistEntries();
    setUsers(entries);
    setFetching(false);
  }

  useEffect(() => {
    if (!loading && isAdmin) loadUsers();
    if (!loading && !isAdmin) setFetching(false);
  }, [loading, isAdmin]);

  async function handleBulkAdd() {
    const emails = textarea.split("\n").map((e) => e.trim()).filter(Boolean);
    if (!emails.length) return;
    setSubmitting(true);
    setResult(null);
    try {
      const res = await bulkAddUsers(emails);
      setResult(res);
      setTextarea("");
      await loadUsers();
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || fetching) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-zinc-500">
        Carregando…
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-zinc-500">
        Acesso restrito a administradores.
      </div>
    );
  }

  const admins = users.filter(isAdminEntry);
  const regularUsers = users.filter((u) => !isAdminEntry(u));

  return (
    <div className="flex flex-col gap-8 pb-12">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Usuários</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Gerencie quem tem acesso ao dashboard.
        </p>
      </div>

      {/* Bulk add */}
      <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-1 text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Adicionar usuários em massa
        </h2>
        <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          Cole um email por linha. Serão adicionados como <strong>usuários comuns</strong>.
        </p>
        <textarea
          value={textarea}
          onChange={(e) => setTextarea(e.target.value)}
          placeholder={"joao@empresa.com\nmaria@empresa.com\npedro@empresa.com"}
          rows={6}
          className="w-full resize-y rounded-xl border border-zinc-300 bg-transparent px-4 py-3 font-mono text-sm outline-none transition focus:border-zinc-500 dark:border-zinc-700 dark:focus:border-zinc-400"
        />
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={handleBulkAdd}
            disabled={submitting || !textarea.trim()}
            className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-40 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {submitting ? "Adicionando…" : "Adicionar"}
          </button>
          {result && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {result.added.length} adicionado{result.added.length !== 1 ? "s" : ""}
              </span>
              {result.skipped.length > 0 && (
                <span className="ml-2 text-zinc-400">
                  · {result.skipped.length} já existia{result.skipped.length !== 1 ? "m" : ""}
                </span>
              )}
            </p>
          )}
        </div>
      </section>

      {/* User lists */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <UserTable title="Administradores" users={admins} badge="admin" />
        <UserTable title="Usuários comuns" users={regularUsers} badge="user" />
      </div>
    </div>
  );
}

function UserTable({
  title,
  users,
  badge,
}: {
  title: string;
  users: WhitelistEntry[];
  badge: "admin" | "user";
}) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{title}</h2>
        <span className="text-xs text-zinc-400">{users.length}</span>
      </div>
      {users.length === 0 ? (
        <p className="px-5 py-4 text-sm text-zinc-400">Nenhum usuário.</p>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {users.map((u) => (
            <li key={u.email} className="flex items-center justify-between px-5 py-2.5">
              <span className="text-sm text-zinc-700 dark:text-zinc-300">{u.email}</span>
              <span
                className={`text-[10px] font-semibold uppercase tracking-wide ${
                  u.hasAccount
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-zinc-400"
                }`}
              >
                {u.hasAccount ? "Ativo" : "Pendente"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

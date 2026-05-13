import { Suspense } from "react";
import Link from "next/link";
import { SidebarNav } from "@/components/SidebarNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuthGuard } from "@/components/AuthGuard";
import { UserMenu } from "@/components/UserMenu";
import { AIChat } from "@/components/AIChat";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="mx-auto flex min-h-screen max-w-[1400px] gap-6 py-6 pr-8 pl-2">
        <aside className="sticky top-6 hidden h-[calc(100vh-3rem)] w-56 shrink-0 flex-col gap-6 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 md:flex">
          <Link href="/" className="block">
            <p className="text-xs uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
              Prota
            </p>
            <p className="text-lg font-semibold">Dashboard</p>
          </Link>
          <Suspense fallback={null}>
            <SidebarNav />
          </Suspense>
          <div className="mt-auto flex flex-col gap-2">
            <UserMenu />
            <ThemeToggle />
          </div>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <AIChat />
    </AuthGuard>
  );
}

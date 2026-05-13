"use client";

import { useEffect, useState } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getWhitelistEntry, markAccountCreated } from "@/lib/whitelist";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

type Step = "email" | "password" | "create";

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (!loading && user) {
      router.replace("/");
    }
  }, [user, loading, router]);

  if (loading || user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700 dark:border-zinc-700 dark:border-t-zinc-300" />
      </div>
    );
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const entry = await getWhitelistEntry(email.trim().toLowerCase());
      if (!entry) {
        setError("Email não autorizado para acesso.");
        return;
      }
      setStep(entry.hasAccount ? "password" : "create");
    } catch {
      setError("Erro ao verificar email. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // redirect handled by useEffect once session+role cookies are set
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
        setError("Senha incorreta.");
      } else if (code === "auth/user-not-found") {
        // Account was deleted — let user re-create
        setStep("create");
        setError("Conta não encontrada. Crie uma nova senha.");
      } else {
        setError("Erro ao entrar. Tente novamente.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }
    setSubmitting(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      await markAccountCreated(email.trim().toLowerCase());
      // redirect handled by useEffect once session+role cookies are set
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === "auth/email-already-in-use") {
        setStep("password");
        setPassword("");
        setError("Conta já existe. Digite sua senha.");
      } else {
        setError("Erro ao criar conta. Tente novamente.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const goBack = () => {
    setStep("email");
    setError("");
    setPassword("");
    setConfirmPassword("");
    setResetSent(false);
  };

  const handleForgotPassword = async () => {
    setError("");
    setResetSent(false);
    setSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
    } catch {
      setError("Erro ao enviar email de recuperação. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-zinc-500 dark:border-zinc-700 dark:focus:border-zinc-400";

  const btnClass =
    "w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200";

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
            Prota
          </p>
          <p className="text-2xl font-semibold">Dashboard</p>
        </div>

        {step === "email" && (
          <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className={inputClass}
                placeholder="seu@email.com"
              />
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button type="submit" disabled={submitting} className={btnClass}>
              {submitting ? "Verificando…" : "Continuar"}
            </button>
          </form>
        )}

        {step === "password" && (
          <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
            <button
              type="button"
              onClick={goBack}
              className="flex items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              ← {email}
            </button>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
                className={inputClass}
                placeholder="••••••••"
              />
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            {resetSent && (
              <p className="text-xs text-green-600 dark:text-green-400">
                Email de recuperação enviado. Verifique sua caixa de entrada.
              </p>
            )}
            <button type="submit" disabled={submitting} className={btnClass}>
              {submitting ? "Entrando…" : "Entrar"}
            </button>
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={submitting}
              className="text-center text-xs text-zinc-500 transition-colors hover:text-zinc-700 disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              Esqueci minha senha
            </button>
          </form>
        )}

        {step === "create" && (
          <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
            <button
              type="button"
              onClick={goBack}
              className="flex items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              ← {email}
            </button>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Primeiro acesso. Crie uma senha para continuar.
            </p>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Criar senha
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
                className={inputClass}
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Confirmar senha
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className={inputClass}
                placeholder="••••••••"
              />
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button type="submit" disabled={submitting} className={btnClass}>
              {submitting ? "Criando conta…" : "Criar conta e entrar"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

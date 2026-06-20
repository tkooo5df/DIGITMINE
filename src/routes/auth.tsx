import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";

type Search = { redirect?: string; mode?: "signin" | "signup" };

function safeRedirect(value?: string) {
  if (!value?.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
    mode: s.mode === "signup" ? "signup" : "signin",
  }),
  component: AuthPage,
});

function AuthPage() {
  const { t } = useTranslation();

  const { redirect, mode: initialMode } = Route.useSearch();
  const redirectTo = safeRedirect(redirect);
  const [mode, setMode] = useState<"signin" | "signup">(initialMode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${redirectTo}`,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        // If session is returned (email confirmation disabled), go straight to redirect
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session) {
          window.location.href = redirectTo;
          return;
        }
        setError(t("Check your email to confirm your account, then sign in."));
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = redirectTo;
      }
    } catch (err: any) {
      setError(err.message ?? t("Something went wrong"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-md mx-auto px-6 py-24 w-full">
        <p className="font-mono-label text-muted-foreground mb-4">{t("Members only")}</p>
        <h1 className="font-display text-5xl mb-12">
          {mode === "signin" ? (
            <>
              {t("Sign in.")}
              <br />
              <span className="italic text-primary">{t("Welcome back.")}</span>
            </>
          ) : (
            <>
              {t("Join.")}
              <br />
              <span className="italic text-primary">{t("In seconds.")}</span>
            </>
          )}
        </h1>

        <form onSubmit={submit} className="space-y-4">
          {mode === "signup" && (
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t("Full name")}
              className="w-full bg-surface border border-border px-4 py-3 rounded-md focus:border-primary outline-none"
            />
          )}
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("Email")}
            className="w-full bg-surface border border-border px-4 py-3 rounded-md focus:border-primary outline-none"
          />
          <input
            required
            type="password"
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("Password")}
            className="w-full bg-surface border border-border px-4 py-3 rounded-md focus:border-primary outline-none"
          />
          {error && <p className="font-mono-label text-destructive">{error}</p>}
          <button
            disabled={loading}
            className="w-full rounded-full bg-primary text-primary-foreground px-8 py-4 font-mono-label hover:shadow-glow transition-all disabled:opacity-50"
          >
            {loading ? "…" : mode === "signin" ? t("Sign in") : t("Create account")}
          </button>
        </form>

        <p className="font-mono-label text-muted-foreground text-center mt-8">
          {mode === "signin" ? (
            <>
              {t("No account?")}{" "}
              <button onClick={() => setMode("signup")} className="text-primary hover:underline">
                {t("Sign up")}
              </button>
            </>
          ) : (
            <>
              {t("Have an account?")}{" "}
              <button onClick={() => setMode("signin")} className="text-primary hover:underline">
                {t("Sign in")}
              </button>
            </>
          )}
        </p>
      </main>
      <Footer />
    </div>
  );
}

"use client";

import { Lock, LogIn, LogOut, Mail, UserRound, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";
import { getAuthDisplayName, upsertProfile, useAuth } from "@/lib/use-auth";
import { cn } from "@/lib/utils";

type Mode = "login" | "signup";

type AuthPanelProps = {
  variant?: "glass" | "header";
};

export function AuthPanel({ variant = "glass" }: AuthPanelProps) {
  const { user, profile, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const displayName = profile?.display_name || getAuthDisplayName(user);
  const headerMode = variant === "header";

  async function handleSignOut() {
    await supabase.auth.signOut();
    setOpen(false);
  }

  if (loading) {
    return (
      <div
        className={cn(
          "h-10 w-24 animate-pulse rounded-full border",
          headerMode ? "border-border bg-muted" : "border-white/20 bg-white/10"
        )}
      />
    );
  }

  return (
    <>
      {user ? (
        <div className="flex items-center justify-end gap-2">
          <div
            className={cn(
              "flex min-h-11 items-center gap-2 rounded-full border px-2 py-1.5 pr-3 text-right text-xs",
              headerMode
                ? "border-border bg-background/70 text-foreground shadow-sm"
                : "border-white/20 bg-white/12 text-white backdrop-blur-md"
            )}
          >
            <span
              className={cn(
                "grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full border",
                headerMode
                  ? "border-border bg-muted"
                  : "border-white/18 bg-white/10"
              )}
            >
              {profile?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatar_url}
                  alt={`${displayName} 頭像`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <UserRound
                  className={cn(
                    "h-4 w-4",
                    headerMode ? "text-muted-foreground" : "text-white/72"
                  )}
                />
              )}
            </span>
            <div className="hidden sm:block">
              <p className="max-w-24 truncate font-medium md:max-w-32">
                {displayName}
              </p>
              <p
                className={cn(
                  "max-w-32 truncate",
                  headerMode ? "text-muted-foreground" : "text-white/62"
                )}
              >
                {user.email}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className={cn(
              "hidden h-10 w-10 items-center justify-center rounded-full border transition focus-visible:outline-none focus-visible:ring-2 sm:inline-flex",
              headerMode
                ? "border-border bg-background/70 hover:border-primary/60 hover:text-primary focus-visible:ring-ring/60"
                : "border-white/20 bg-white/12 text-white hover:bg-white/22 focus-visible:ring-white/60"
            )}
            aria-label="登出"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "inline-flex min-h-10 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2",
            headerMode
              ? "border-border bg-background/70 text-foreground hover:border-primary/60 hover:text-primary focus-visible:ring-ring/60"
              : "border-white/20 bg-white/12 text-white backdrop-blur-md hover:bg-white/22 focus-visible:ring-white/60"
          )}
        >
          <LogIn className="h-4 w-4" />
          登入
        </button>
      )}

      <AuthDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function AuthDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mode, setMode] = useState<Mode>("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setError(null);
    setMessage(null);

    if (mode === "signup" && password.length < 6) {
      setPending(false);
      setError("密碼至少需要 6 個字元。");
      return;
    }

    if (mode === "signup") {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            display_name: displayName.trim() || "匿名旅人",
          },
        },
      });

      if (signUpError) {
        setPending(false);
        setError(signUpError.message);
        return;
      }

      if (data.session?.user) {
        await upsertProfile(data.session.user, displayName);
        setPending(false);
        onClose();
        return;
      }

      setPending(false);
      setMessage("註冊完成，請依照信箱提示完成驗證後登入。");
      return;
    }

    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (loginError) {
      setPending(false);
      setError(loginError.message);
      return;
    }

    if (data.user) await upsertProfile(data.user);
    setPending(false);
    onClose();
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/72 p-3 backdrop-blur-sm sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            className="w-full max-w-md rounded-2xl border border-border bg-card p-4 shadow-2xl sm:p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  TripWall Account
                </p>
                <h2 className="mt-1 text-2xl font-semibold">
                  {mode === "login" ? "登入帳號" : "建立帳號"}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background/70 transition hover:border-primary/60 hover:text-primary"
                aria-label="關閉"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 rounded-full border border-border bg-background/70 p-1">
              <ModeButton active={mode === "login"} onClick={() => setMode("login")}>
                登入
              </ModeButton>
              <ModeButton active={mode === "signup"} onClick={() => setMode("signup")}>
                註冊
              </ModeButton>
            </div>

            <div className="mt-4 grid gap-3">
              {mode === "signup" ? (
                <Field icon={<UserRound className="h-4 w-4" />}>
                  <input
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    maxLength={30}
                    placeholder="暱稱"
                    className="field-input pl-9"
                  />
                </Field>
              ) : null}
              <Field icon={<Mail className="h-4 w-4" />}>
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="email@example.com"
                  className="field-input pl-9"
                />
              </Field>
              <Field icon={<Lock className="h-4 w-4" />}>
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  required
                  minLength={6}
                  placeholder="至少 6 個字元"
                  className="field-input pl-9"
                />
              </Field>
            </div>

            {message ? <p className="mt-3 text-sm text-primary">{message}</p> : null}
            {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

            <button
              type="submit"
              disabled={pending}
              className={cn(
                "mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 disabled:cursor-not-allowed disabled:opacity-55"
              )}
            >
              {pending ? "處理中" : mode === "login" ? "登入" : "建立帳號"}
            </button>
          </motion.form>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-9 rounded-full text-sm font-medium transition",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function Field({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="relative block">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
        {icon}
      </span>
      {children}
    </label>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/live/Visuals";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { cn } from "@/lib/utils";

// Self-hosters can hide Google sign-in when it isn't configured on their backend.
const GOOGLE_ENABLED = import.meta.env['VITE_ENABLE_GOOGLE_AUTH'] !== "false";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — huddle" },
      { name: "description", content: "Sign in to save your huddle sessions, reuse them and track past results." },
      { property: "og:title", content: "Sign in to huddle" },
      { property: "og:description", content: "Save, edit and relaunch your live sessions." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up" | "forgot">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { if (data.user) navigate({ to: "/dashboard", replace: true }); });
    const { data: sub } = supabase.auth.onAuthStateChange((e, s) => { if (e === "SIGNED_IN" && s) navigate({ to: "/dashboard", replace: true }); });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === "up") {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/dashboard", data: { full_name: name } } });
        if (error) throw error;
        if (!data.session) setSent("Check your inbox to confirm your email, then sign in.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        setSent("If that email has an account, a reset link is on its way.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) toast.error("Google sign-in didn't work");
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-6">
      <Link to="/"><Logo /></Link>
      <div className="card-ink mt-8 flex flex-col gap-5 rounded-3xl p-6 animate-pop">
        <h1 className="font-display text-3xl font-extrabold">
          {mode === "in" ? "Welcome back 👋" : mode === "up" ? "Make an account ✨" : "Reset password 🔑"}
        </h1>
        {sent ? (
          <p className="rounded-2xl bg-accent p-4 font-semibold">{sent}</p>
        ) : (
          <>
            {mode !== "forgot" && GOOGLE_ENABLED && (
              <button onClick={google} className="chunky rounded-2xl bg-card py-3 font-bold">Continue with Google</button>
            )}
            <form onSubmit={submit} className="flex flex-col gap-3">
              {mode === "up" && <Input value={name} onChange={setName} placeholder="Your name" />}
              <Input value={email} onChange={setEmail} placeholder="Email" type="email" />
              {mode !== "forgot" && <Input value={password} onChange={setPassword} placeholder="Password (6+ characters)" type="password" />}
              <button disabled={busy} className="chunky rounded-2xl bg-btn py-3 font-display text-lg font-bold text-btn-foreground">
                {busy ? "…" : mode === "in" ? "Sign in" : mode === "up" ? "Create account" : "Send reset link"}
              </button>
            </form>
          </>
        )}
        <div className="flex flex-wrap justify-between gap-2 text-sm font-semibold">
          {mode !== "in" && <button onClick={() => { setMode("in"); setSent(""); }} className="underline">Have an account? Sign in</button>}
          {mode !== "up" && <button onClick={() => { setMode("up"); setSent(""); }} className="underline">New here? Sign up</button>}
          {mode === "in" && <button onClick={() => { setMode("forgot"); setSent(""); }} className="text-muted-foreground underline">Forgot password?</button>}
        </div>
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">Players never need an account — just a PIN.</p>
    </div>
  );
}

function Input({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (v: string) => void; placeholder: string; type?: string }) {
  return (
    <input
      required={placeholder !== "Your name"}
      minLength={type === "password" ? 6 : undefined}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn("rounded-2xl border-2 border-ink bg-background px-4 py-3 font-semibold outline-none focus:ring-4 focus:ring-ring/30")}
    />
  );
}

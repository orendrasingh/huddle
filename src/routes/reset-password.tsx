import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/live/Visuals";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Choose a new password — huddle" },
      { name: "description", content: "Set a new password for your huddle account." },
      { property: "og:title", content: "Reset your huddle password" },
      { property: "og:description", content: "Pick a new password and get back to hosting." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Reset,
});

function Reset() {
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Password updated");
    navigate({ to: "/dashboard" });
  }
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-6">
      <Link to="/"><Logo /></Link>
      <form onSubmit={submit} className="card-ink mt-8 flex flex-col gap-4 rounded-3xl p-6">
        <h1 className="font-display text-3xl font-extrabold">New password 🔑</h1>
        <input type="password" required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password" className="rounded-2xl border-2 border-ink bg-background px-4 py-3 outline-none" />
        <button disabled={busy} className="chunky rounded-2xl bg-btn py-3 font-display font-bold text-btn-foreground">Save password</button>
      </form>
    </div>
  );
}

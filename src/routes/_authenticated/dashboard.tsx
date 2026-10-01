import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { DonatePrompt } from "@/components/Donate";
import { Logo } from "@/components/live/Visuals";
import { cleanQuestions, validateDraft } from "@/components/editor/Editor";
import { supabase } from "@/integrations/supabase/client";
import { sampleActivity, TYPE_META, type Question } from "@/lib/game";
import { createOwnedRoom } from "@/lib/room.functions";
import { themeOf } from "@/lib/theme";
import { play } from "@/lib/sound";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "My sessions — huddle" },
      { name: "description", content: "Your saved huddle sessions and past results." },
      { property: "og:title", content: "My huddle sessions" },
      { property: "og:description", content: "Create, edit and relaunch your live sessions." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const launchFn = useServerFn(createOwnedRoom);
  const [busy, setBusy] = useState<string | null>(null);

  const profile = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle()).data,
  });
  const quizzes = useQuery({
    queryKey: ["quizzes", user.id],
    queryFn: async () => (await supabase.from("quizzes").select("*").order("updated_at", { ascending: false })).data ?? [],
  });
  const history = useQuery({
    queryKey: ["history", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("rooms").select("id, title, created_at, phase, players(nickname, avatar, score)").eq("owner_id", user.id).order("created_at", { ascending: false }).limit(12);
      return data ?? [];
    },
  });

  async function newQuiz() {
    setBusy("new");
    const s = sampleActivity();
    const { data, error } = await supabase
      .from("quizzes")
      .insert({ owner_id: user.id, title: "Untitled huddle", slides: s.questions as never, theme: (profile.data?.default_theme ?? {}) as never })
      .select("id")
      .single();
    setBusy(null);
    if (error || !data) { toast.error("Couldn't create"); return; }
    navigate({ to: "/edit/$quizId", params: { quizId: data.id } });
  }
  async function duplicate(id: string) {
    const src = quizzes.data?.find((q) => q.id === id);
    if (!src) return;
    await supabase.from("quizzes").insert({ owner_id: user.id, title: `${src.title} (copy)`, slides: src.slides, theme: src.theme, settings: src.settings });
    qc.invalidateQueries({ queryKey: ["quizzes"] });
  }
  async function remove(id: string) {
    if (!confirm("Delete this session? This can't be undone.")) return;
    await supabase.from("quizzes").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["quizzes"] });
  }
  async function launch(id: string) {
    const q = quizzes.data?.find((x) => x.id === id);
    if (!q) return;
    const draft = { title: q.title, questions: q.slides as unknown as Question[], theme: q.theme as object, settings: q.settings as object };
    const errs = validateDraft(draft);
    if (errs.length) { toast.error(errs[0]); navigate({ to: "/edit/$quizId", params: { quizId: id } }); return; }
    setBusy(id);
    try {
      const res = await launchFn({ data: { title: q.title || "Untitled huddle", questions: cleanQuestions(draft.questions), theme: draft.theme as Record<string, string>, settings: draft.settings, quizId: id } });
      localStorage.setItem(`huddle:host:${res.roomId}`, res.hostToken);
      play("start");
      navigate({ to: "/host/$roomId", params: { roomId: res.roomId } });
    } catch {
      toast.error("Couldn't start the room");
      setBusy(null);
    }
  }
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  async function rename() {
    const n = prompt("Display name", profile.data?.display_name ?? "");
    if (n == null) return;
    await supabase.from("profiles").upsert({ id: user.id, display_name: n.slice(0, 60) });
    qc.invalidateQueries({ queryKey: ["profile"] });
  }

  return (
    <div className="min-h-screen">
      <DonatePrompt />
      <header className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-5">
        <Link to="/"><Logo /></Link>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={rename} className="rounded-full bg-secondary px-3 py-1.5 text-sm font-bold">👤 {profile.data?.display_name || user.email}</button>
          <button onClick={signOut} className="rounded-full border-2 border-ink bg-card px-3 py-1.5 text-sm font-bold">Sign out</button>
        </div>
      </header>
      <main className="mx-auto flex max-w-6xl flex-col gap-10 px-6 pb-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-display text-5xl font-extrabold">My sessions</h1>
          <button onClick={newQuiz} disabled={busy === "new"} className="chunky flex items-center gap-2 rounded-full bg-btn px-6 py-3 font-display font-bold text-btn-foreground"><Plus size={18} /> New session</button>
        </div>

        {quizzes.isLoading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : !quizzes.data?.length ? (
          <div className="card-ink grid place-items-center gap-3 rounded-3xl p-12 text-center">
            <p className="text-5xl">🎈</p>
            <p className="font-display text-2xl font-bold">Nothing saved yet</p>
            <p className="text-muted-foreground">Create your first session — it autosaves as you go.</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {quizzes.data.map((q) => {
              const slides = (q.slides as unknown as Question[]) ?? [];
              const t = themeOf(q.theme as object);
              return (
                <div key={q.id} className="card-ink flex flex-col overflow-hidden rounded-3xl">
                  <div className="flex h-20 items-center gap-2 border-b-2 border-ink px-4" style={{ background: t.bgType === "gradient" ? `linear-gradient(135deg, ${t.background}, ${t.background2})` : t.background }}>
                    {t.logo ? <img src={t.logo} alt="" className="h-10 max-w-24 object-contain" /> : null}
                    <div className="ml-auto flex">{[t.primary, t.accent, t.button].map((c, i) => <span key={i} className="-ml-2 h-7 w-7 rounded-full border-2 border-ink" style={{ background: c }} />)}</div>
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <h2 className="line-clamp-1 font-display text-xl font-extrabold">{q.title}</h2>
                    <p className="text-sm text-muted-foreground">{slides.length} slides · {[...new Set(slides.map((s) => TYPE_META[s.type]?.emoji))].join(" ")}</p>
                    <p className="text-xs text-muted-foreground">Edited {new Date(q.updated_at).toLocaleDateString()}</p>
                    <div className="mt-auto flex gap-2 pt-2">
                      <button onClick={() => launch(q.id)} disabled={busy === q.id} className="chunky flex flex-1 items-center justify-center gap-1 rounded-full bg-btn py-2 text-sm font-bold text-btn-foreground"><Play size={14} /> Host</button>
                      <Link to="/edit/$quizId" params={{ quizId: q.id }} className="grid h-10 w-10 place-items-center rounded-full border-2 border-ink bg-card" aria-label="Edit"><Pencil size={16} /></Link>
                      <button onClick={() => duplicate(q.id)} className="grid h-10 w-10 place-items-center rounded-full border-2 border-ink bg-card" aria-label="Duplicate"><Copy size={16} /></button>
                      <button onClick={() => remove(q.id)} className="grid h-10 w-10 place-items-center rounded-full border-2 border-ink bg-card" aria-label="Delete"><Trash2 size={16} /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <section className="flex flex-col gap-4">
          <h2 className="font-display text-3xl font-extrabold">Past sessions</h2>
          {!history.data?.length ? (
            <p className="text-muted-foreground">Sessions you host from here will show up with their results.</p>
          ) : (
            <div className="grid gap-3">
              {history.data.map((r) => {
                const ps = [...((r.players as { nickname: string; avatar: string; score: number }[]) ?? [])].sort((a, b) => b.score - a.score);
                return (
                  <div key={r.id} className="card-ink flex flex-wrap items-center gap-4 rounded-2xl px-5 py-3">
                    <div className="min-w-40 flex-1">
                      <p className="font-bold">{r.title}</p>
                      <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()} · {ps.length} players · {r.phase === "ended" ? "finished" : "in progress"}</p>
                    </div>
                    <div className="flex gap-2">
                      {ps.slice(0, 3).map((p, i) => (
                        <span key={i} className="rounded-full bg-secondary px-3 py-1 text-sm font-bold">{["🥇", "🥈", "🥉"][i]} {p.avatar} {p.nickname} · {p.score}</span>
                      ))}
                    </div>
                    {r.phase !== "ended" && <Link to="/host/$roomId" params={{ roomId: r.id }} className="text-sm font-bold underline">Open</Link>}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

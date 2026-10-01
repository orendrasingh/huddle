import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Editor, cleanQuestions, validateDraft, type Draft } from "@/components/editor/Editor";
import { DonatePrompt } from "@/components/Donate";
import { Logo } from "@/components/live/Visuals";
import { convertQuestion, sampleActivity, type Question } from "@/lib/game";
import { createRoom } from "@/lib/room.functions";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/lib/use-auth";
import { play } from "@/lib/sound";

export const Route = createFileRoute("/create")({
  head: () => ({
    meta: [
      { title: "Create an activity — huddle" },
      { name: "description", content: "Draft slides, trivia, polls and word clouds, theme them and go live in one click." },
      { property: "og:title", content: "Build a live activity with huddle" },
      { property: "og:description", content: "Draft, reorder and customise slides, then launch a live room." },
    ],
  }),
  component: Create,
});

const KEY = "huddle:draft";

/** Old drafts stored options as strings. */
function migrate(qs: unknown[]): Question[] {
  return (qs as Question[]).map((q) => {
    const opts = (q.options as unknown[]).map((o) => (typeof o === "string" ? { text: o } : o)) as Question["options"];
    const fixed = { ...q, options: opts };
    return q.type ? fixed : convertQuestion(fixed, "quiz");
  });
}

function Create() {
  const navigate = useNavigate();
  const create = useServerFn(createRoom);
  const { user } = useUser();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(KEY);
    const d = raw ? JSON.parse(raw) : sampleActivity();
    setDraft({ title: d.title ?? "", questions: migrate(d.questions ?? []), theme: d.theme ?? {}, settings: d.settings ?? {} });
  }, []);
  useEffect(() => {
    if (draft) localStorage.setItem(KEY, JSON.stringify(draft));
  }, [draft]);

  async function launch() {
    if (!draft) return;
    const errs = validateDraft(draft);
    if (errs.length) { toast.error(errs[0]); return; }
    setBusy(true);
    try {
      const res = await create({ data: { title: draft.title.trim() || "Untitled huddle", questions: cleanQuestions(draft.questions), theme: draft.theme as Record<string, string>, settings: draft.settings } });
      localStorage.setItem(`huddle:host:${res.roomId}`, res.hostToken);
      play("start");
      navigate({ to: "/host/$roomId", params: { roomId: res.roomId } });
    } catch {
      toast.error("Couldn't start the room");
      setBusy(false);
    }
  }

  async function saveToAccount() {
    if (!draft || !user) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("quizzes")
      .insert({ owner_id: user.id, title: draft.title || "Untitled huddle", slides: draft.questions as never, theme: draft.theme as never, settings: draft.settings as never })
      .select("id")
      .single();
    setBusy(false);
    if (error || !data) { toast.error("Couldn't save"); return; }
    localStorage.removeItem(KEY);
    toast.success("Saved to your sessions");
    navigate({ to: "/edit/$quizId", params: { quizId: data.id } });
  }

  if (!draft) return null;

  return (
    <>
    <DonatePrompt />
    <h1 className="sr-only">Create a huddle session</h1>
    <Editor
      value={draft}
      onChange={setDraft}
      canUpload={!!user}
      status={user ? "Draft on this device" : "Draft saved on this device — sign in to keep it"}
      headerRight={
        <div className="flex items-center gap-2">
          <Link to="/" className="hidden sm:block"><Logo className="text-xl" /></Link>
          {user ? (
            <button onClick={saveToAccount} disabled={busy} className="rounded-full border-2 border-ink bg-card px-4 py-2 text-sm font-bold">Save to account</button>
          ) : (
            <Link to="/auth" className="rounded-full border-2 border-ink bg-card px-4 py-2 text-sm font-bold">Sign in to save</Link>
          )}
          <button onClick={launch} disabled={busy} className="chunky rounded-full bg-btn px-5 py-2 font-display font-bold text-btn-foreground">
            {busy ? "…" : "▶ Go live"}
          </button>
        </div>
      }
    />
    </>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Editor, cleanQuestions, validateDraft, type Draft } from "@/components/editor/Editor";
import { supabase } from "@/integrations/supabase/client";
import type { Question } from "@/lib/game";
import { createOwnedRoom } from "@/lib/room.functions";
import { play } from "@/lib/sound";

export const Route = createFileRoute("/_authenticated/edit/$quizId")({
  head: () => ({
    meta: [
      { title: "Editing session — huddle" },
      { name: "description", content: "Edit slides, theme and settings for your huddle session." },
      { property: "og:title", content: "Edit a huddle session" },
      { property: "og:description", content: "Slides, theme and host settings in one place." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EditQuiz,
});

function EditQuiz() {
  const { quizId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const launchFn = useServerFn(createOwnedRoom);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [missing, setMissing] = useState(false);
  const [saved, setSaved] = useState<"saved" | "saving" | "error">("saved");
  const [busy, setBusy] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    supabase.from("quizzes").select("*").eq("id", quizId).maybeSingle().then(({ data }) => {
      if (!data) { setMissing(true); return; }
      setDraft({ title: data.title, questions: (data.slides as unknown as Question[]) ?? [], theme: (data.theme as object) ?? {}, settings: (data.settings as object) ?? {} });
    });
  }, [quizId]);

  // autosave
  useEffect(() => {
    if (!draft) return;
    if (first.current) { first.current = false; return; }
    setSaved("saving");
    const t = setTimeout(async () => {
      const { error } = await supabase
        .from("quizzes")
        .update({ title: draft.title || "Untitled huddle", slides: draft.questions as never, theme: draft.theme as never, settings: draft.settings as never, updated_at: new Date().toISOString() })
        .eq("id", quizId);
      setSaved(error ? "error" : "saved");
    }, 800);
    return () => clearTimeout(t);
  }, [draft, quizId]);

  async function launch() {
    if (!draft) return;
    const errs = validateDraft(draft);
    if (errs.length) { toast.error(errs[0]); return; }
    setBusy(true);
    try {
      const res = await launchFn({ data: { title: draft.title.trim() || "Untitled huddle", questions: cleanQuestions(draft.questions), theme: draft.theme as Record<string, string>, settings: draft.settings, quizId } });
      localStorage.setItem(`huddle:host:${res.roomId}`, res.hostToken);
      play("start");
      navigate({ to: "/host/$roomId", params: { roomId: res.roomId } });
    } catch {
      toast.error("Couldn't start the room");
      setBusy(false);
    }
  }

  async function saveDefaultTheme() {
    if (!draft) return;
    const { error } = await supabase.from("profiles").upsert({ id: user.id, default_theme: draft.theme as never });
    if (error) toast.error("Couldn't save"); else toast.success("New sessions will start with this theme");
  }

  if (missing) return <div className="grid min-h-screen place-items-center text-lg font-semibold">Session not found. <Link to="/dashboard" className="underline">Back</Link></div>;
  if (!draft) return <div className="grid min-h-screen place-items-center text-muted-foreground">Loading…</div>;

  return (
    <Editor
      value={draft}
      onChange={setDraft}
      canUpload
      status={saved === "saving" ? "Saving…" : saved === "error" ? "Couldn't save" : "All changes saved"}
      headerRight={
        <div className="flex items-center gap-2">
          <Link to="/dashboard" className="grid h-10 w-10 place-items-center rounded-full border-2 border-ink bg-card" aria-label="Back to sessions"><ArrowLeft size={18} /></Link>
          <button onClick={saveDefaultTheme} className="hidden rounded-full border-2 border-ink bg-card px-4 py-2 text-sm font-bold md:block">Set theme as my default</button>
          <button onClick={launch} disabled={busy} className="chunky rounded-full bg-btn px-5 py-2 font-display font-bold text-btn-foreground">{busy ? "…" : "▶ Go live"}</button>
        </div>
      }
    />
  );
}

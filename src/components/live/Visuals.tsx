import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ANSWER_COLORS, ANSWER_SHAPES, optImage, optText, youtubeId,
  type Media, type Player, type Question, type Response,
} from "@/lib/game";
import { cn } from "@/lib/utils";

export function Logo({ className, src }: { className?: string | undefined; src?: string | undefined }) {
  if (src) return <img src={src} alt="huddle logo" className={cn("h-9 w-auto max-w-40 object-contain", className)} />;
  return (
    <span className={cn("font-display text-2xl font-extrabold tracking-tight", className)}>
      huddle<span className="text-primary">.</span>
    </span>
  );
}

export function MediaView({ media, className }: { media?: Media | null | undefined; className?: string | undefined }) {
  if (!media?.url) return null;
  if (media.kind === "image") return <img src={media.url} alt="" className={cn("mx-auto max-h-80 rounded-2xl border-2 border-ink object-contain", className)} />;
  if (media.kind === "video") return <video src={media.url} controls playsInline className={cn("mx-auto max-h-80 rounded-2xl border-2 border-ink", className)} />;
  const id = youtubeId(media.url);
  if (!id) return null;
  return (
    <div className={cn("mx-auto aspect-video w-full max-w-2xl overflow-hidden rounded-2xl border-2 border-ink", className)}>
      <iframe src={`https://www.youtube.com/embed/${id}`} title="Video" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen className="h-full w-full" />
    </div>
  );
}

export function Bars({ question, responses, highlightCorrect }: { question: Question; responses: Response[]; highlightCorrect?: boolean }) {
  const counts: number[] = question.options.map((_, i) => responses.filter((r) => r.answer === String(i)).length);
  const max = Math.max(1, ...counts);
  const total = counts.reduce((a, b) => a + b, 0);
  const graded = question.type === "quiz" || question.type === "truefalse";
  return (
    <div className="flex h-72 items-end justify-center gap-3 sm:gap-8">
      {question.options.map((opt, i) => {
        const dim = highlightCorrect && graded && i !== question.correct;
        const img = optImage(opt);
        return (
          <div key={i} className={cn("flex w-20 flex-col items-center gap-2 transition-opacity sm:w-32", dim && "opacity-35")}>
            <span className="font-display text-3xl font-extrabold tabular-nums">{counts[i] ?? 0}</span>
            <div
              className={cn("chunky w-full rounded-t-2xl rounded-b-md", ANSWER_COLORS[i])}
              style={{ height: `${8 + ((counts[i] ?? 0) / max) * 180}px`, transition: "height 600ms cubic-bezier(0.34,1.56,0.64,1)" }}
            />
            {img && <img src={img} alt="" className="h-12 w-12 rounded-lg border-2 border-ink object-cover" />}
            <div className="flex items-center gap-1 text-center text-sm font-semibold">
              <span>{ANSWER_SHAPES[i]}</span>
              <span className="line-clamp-2">{optText(opt)}</span>
              {highlightCorrect && graded && i === question.correct && <span>✓</span>}
            </div>
            {!graded && <span className="text-xs text-muted-foreground">{total ? Math.round(((counts[i] ?? 0) / total) * 100) : 0}%</span>}
          </div>
        );
      })}
    </div>
  );
}

const CLOUD_COLORS = ["text-a1", "text-a2", "text-a4", "text-a5", "text-a6", "text-primary"];
const ROT = ["-rotate-2", "rotate-1", "rotate-0", "-rotate-1", "rotate-2"];

export function WordCloud({ responses, small }: { responses: Response[]; small?: boolean | undefined }) {
  const counts = new Map<string, number>();
  for (const r of responses) counts.set(r.answer, (counts.get(r.answer) ?? 0) + 1);
  const words = [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const max = Math.max(1, ...counts.values());
  const k = small ? 0.5 : 1;
  if (!words.length)
    return <p className="py-16 text-center font-display text-2xl text-muted-foreground animate-floaty">Words will bloom here…</p>;
  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-x-6 gap-y-2 px-4 py-6", !small && "min-h-72")}>
      {words.map(([w, c], i) => (
        <span
          key={w}
          className={cn("animate-pop font-display font-extrabold leading-none", CLOUD_COLORS[i % CLOUD_COLORS.length], ROT[i % ROT.length])}
          style={{ fontSize: `${(18 + (c / max) * 64) * k}px`, transition: "font-size 500ms cubic-bezier(0.34,1.56,0.64,1)" }}
          title={`${c}`}
        >
          {w}
        </span>
      ))}
    </div>
  );
}

export function Wall({ responses, players }: { responses: Response[]; players?: Player[] | undefined }) {
  const byId = new Map(players?.map((p) => [p.id, p]));
  if (!responses.length) return <p className="py-16 text-center font-display text-2xl text-muted-foreground animate-floaty">Answers will pin up here…</p>;
  return (
    <div className="columns-1 gap-3 py-2 sm:columns-2 lg:columns-3">
      {responses.map((r, i) => (
        <div key={r.id} className={cn("card-ink mb-3 break-inside-avoid rounded-2xl px-4 py-3 animate-pop", ROT[i % ROT.length])}>
          <p className="font-semibold">{r.answer}</p>
          {byId.get(r.player_id) && <p className="mt-1 text-xs text-muted-foreground">{byId.get(r.player_id)!.avatar} {byId.get(r.player_id)!.nickname}</p>}
        </div>
      ))}
    </div>
  );
}

export function ScaleResult({ question, responses }: { question: Question; responses: Response[] }) {
  const max = question.scaleMax ?? 5;
  const counts = Array.from({ length: max }, (_, i) => responses.filter((r) => r.answer === String(i + 1)).length);
  const top = Math.max(1, ...counts);
  const total = counts.reduce((a, b) => a + b, 0);
  const avg = total ? counts.reduce((a, c, i) => a + c * (i + 1), 0) / total : 0;
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="font-display text-6xl font-extrabold tabular-nums">{total ? avg.toFixed(1) : "–"}<span className="text-2xl text-muted-foreground">/{max}</span></p>
      <div className="flex h-40 w-full max-w-2xl items-end gap-2">
        {counts.map((c, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-sm font-bold tabular-nums">{c}</span>
            <div className="chunky w-full rounded-t-xl bg-primary" style={{ height: `${6 + (c / top) * 110}px`, transition: "height 500ms cubic-bezier(0.34,1.56,0.64,1)" }} />
            <span className="text-sm font-bold">{i + 1}</span>
          </div>
        ))}
      </div>
      <div className="flex w-full max-w-2xl justify-between text-sm font-semibold text-muted-foreground">
        <span>{question.scaleLabels?.[0]}</span><span>{question.scaleLabels?.[1]}</span>
      </div>
    </div>
  );
}

export function CorrectCount({ responses, label, answer }: { responses: Response[]; label?: string; answer?: React.ReactNode }) {
  const right = responses.filter((r) => r.is_correct).length;
  return (
    <div className="grid place-items-center gap-4 py-6 text-center">
      {answer}
      <p className="font-display text-7xl font-extrabold tabular-nums animate-pop">{right}<span className="text-3xl text-muted-foreground">/{responses.length}</span></p>
      <p className="text-muted-foreground">{label ?? "got it right"}</p>
    </div>
  );
}

/** Picks the right results view for a slide. */
export function Results({ q, responses, players, reveal, small }: { q: Question; responses: Response[]; players?: Player[] | undefined; reveal: boolean; small?: boolean | undefined | undefined }) {
  switch (q.type) {
    case "cloud":
      return q.wall ? <Wall responses={responses} players={players} /> : <WordCloud responses={responses} small={small} />;
    case "open":
      return <Wall responses={responses} players={players} />;
    case "scale":
      return <ScaleResult question={q} responses={responses} />;
    case "typeanswer":
      return (
        <CorrectCount
          responses={responses}
          answer={reveal ? <p className="rounded-2xl border-2 border-ink bg-success px-5 py-2 font-display text-2xl font-bold text-on-answer">✓ {q.accepted?.filter(Boolean).join(" / ")}</p> : null}
        />
      );
    case "order":
      return (
        <CorrectCount
          responses={responses}
          label="got the order right"
          answer={reveal ? (
            <ol className="flex flex-wrap justify-center gap-2">
              {q.options.map((o, i) => (
                <li key={i} className={cn("chunky rounded-xl px-3 py-1.5 font-bold text-on-answer", ANSWER_COLORS[i])}>{i + 1}. {optText(o)}</li>
              ))}
            </ol>
          ) : null}
        />
      );
    default:
      return <Bars question={q} responses={responses} highlightCorrect={reveal} />;
  }
}

export function Leaderboard({ players, limit = 5, highlight }: { players: Player[]; limit?: number; highlight?: string }) {
  const sorted = [...players].sort((a, b) => b.score - a.score).slice(0, limit);
  return (
    <ol className="mx-auto flex w-full max-w-xl flex-col gap-3">
      {sorted.map((p, i) => (
        <li
          key={p.id}
          className={cn("card-ink animate-pop flex items-center gap-4 rounded-2xl px-5 py-3", p.id === highlight && "bg-accent")}
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <span className="w-8 font-display text-2xl font-extrabold text-muted-foreground">{i + 1}</span>
          <span className="text-3xl">{p.avatar}</span>
          <span className="flex-1 truncate text-lg font-bold">{p.nickname}</span>
          {p.streak >= 2 && <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">🔥 {p.streak}</span>}
          <span className="font-display text-xl font-extrabold tabular-nums">{p.score}</span>
        </li>
      ))}
    </ol>
  );
}

export function TimerRing({ seconds, total }: { seconds: number | null; total: number | null }) {
  if (seconds == null || !total) return null;
  const pct = total ? seconds / total : 0;
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className={cn("relative grid h-20 w-20 shrink-0 place-items-center", seconds <= 5 && seconds > 0 && "animate-wiggle")} key={seconds <= 5 ? seconds : "t"}>
      <svg viewBox="0 0 80 80" className="absolute inset-0 -rotate-90">
        <circle cx="40" cy="40" r={r} className="fill-card stroke-ink" strokeWidth="3" />
        <circle
          cx="40" cy="40" r={r} fill="none" strokeWidth="7" strokeLinecap="round"
          className={seconds <= 5 ? "stroke-a1" : "stroke-a3"}
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset 250ms linear" }}
        />
      </svg>
      <span className="relative font-display text-2xl font-extrabold tabular-nums">{seconds}</span>
    </div>
  );
}

/** Floating emoji reactions sent by players over a broadcast channel. */
export function ReactionsLayer({ roomId }: { roomId: string }) {
  const [items, setItems] = useState<{ id: number; e: string; x: number }[]>([]);
  useEffect(() => {
    const ch = supabase
      .channel(`reactions-${roomId}`)
      .on("broadcast", { event: "react" }, ({ payload }) => {
        const e = String((payload as { e?: string })?.e ?? "").slice(0, 4);
        if (!e) return;
        const id = Date.now() + Math.random();
        setItems((all) => [...all.slice(-40), { id, e, x: 5 + Math.random() * 90 }]);
        setTimeout(() => setItems((all) => all.filter((i) => i.id !== id)), 3300);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [roomId]);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 h-0" aria-hidden>
      {items.map((i) => (
        <span key={i.id} className="animate-float-up absolute bottom-4 text-5xl" style={{ left: `${i.x}%` }}>{i.e}</span>
      ))}
    </div>
  );
}

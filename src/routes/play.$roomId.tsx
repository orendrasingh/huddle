import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { ContentSlide } from "@/components/live/ContentSlide";
import { Logo, MediaView, Results, TimerRing } from "@/components/live/Visuals";
import { supabase } from "@/integrations/supabase/client";
import {
  ANSWER_COLORS, ANSWER_SHAPES, REACTIONS, answerLimit, isScored, optImage, optText, remainingSeconds, settingsOf, shuffledOrder, slideFlag,
  type Question, type Room,
} from "@/lib/game";
import { submitAnswer } from "@/lib/room.functions";
import { buzz, play } from "@/lib/sound";
import { themeOf, themeStyle } from "@/lib/theme";
import { useNow, useRoomLive } from "@/lib/use-room";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/play/$roomId")({
  head: () => ({
    meta: [
      { title: "Playing — huddle" },
      { name: "description", content: "You're in a live huddle session. Answer on your phone and watch the big screen." },
      { property: "og:title", content: "Playing huddle" },
      { property: "og:description", content: "Answer live questions from your phone." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Play,
});

function Play() {
  const { roomId } = Route.useParams();
  const { room, players, responses, loaded } = useRoomLive(roomId);
  const submit = useServerFn(submitAnswer);
  const now = useNow(500);
  const [me, setMe] = useState<{ playerId: string; token: string } | null | undefined>(undefined);
  const [sending, setSending] = useState(false);
  const lastFeedback = useRef("");
  const channel = useRef<RealtimeChannel | null>(null);
  const lastReact = useRef(0);

  useEffect(() => {
    const raw = localStorage.getItem(`huddle:player:${roomId}`);
    setMe(raw ? JSON.parse(raw) : null);
    const ch = supabase.channel(`reactions-${roomId}`).subscribe();
    channel.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [roomId]);

  const settings = settingsOf(room?.settings);
  const player = players.find((p) => p.id === me?.playerId);
  const q = room?.questions[room.current_index];
  const mine = room ? responses.filter((r) => r.player_id === me?.playerId && r.question_index === room.current_index) : [];
  const answered = q ? mine.length >= answerLimit(q.type) : false;
  const rank = player ? [...players].sort((a, b) => b.score - a.score).findIndex((p) => p.id === player.id) + 1 : 0;

  useEffect(() => {
    if (!room || room.phase !== "reveal" || !q || !isScored(q.type)) return;
    const key = `${room.current_index}`;
    if (lastFeedback.current === key) return;
    if (mine[0] && mine[0].is_correct == null) return; // grading still arriving
    lastFeedback.current = key;
    if (mine[0]?.is_correct) { play("correct"); buzz([20, 40, 20]); } else { play("wrong"); buzz(120); }
  }, [room?.phase, room?.current_index, mine, q, room]);

  async function send(answer: string) {
    if (!me || sending) return false;
    setSending(true);
    play("tap");
    buzz(15);
    try {
      const res = await submit({ data: { ...me, answer } });
      if ("error" in res && res.error) { toast(res.error); return false; }
      return true;
    } catch {
      toast.error("Didn't send — try again");
      return false;
    } finally {
      setSending(false);
    }
  }

  function react(e: string) {
    const t = Date.now();
    if (t - lastReact.current < 700) return;
    lastReact.current = t;
    buzz(10);
    void channel.current?.send({ type: "broadcast", event: "react", payload: { e } });
  }

  if (!loaded || me === undefined) return <Shell>Loading…</Shell>;
  if (!room) return <Shell>Room not found. <Link to="/" className="underline">Home</Link></Shell>;
  if (!me || (players.length && !player)) return <Shell>You're not in this room yet. <Link to="/join" search={{ pin: room.pin }} className="underline">Join</Link></Shell>;

  const theme = themeOf(room.theme);
  const qResponses = responses.filter((r) => r.question_index === room.current_index);

  return (
    <div className="flex min-h-[100dvh] flex-col" style={themeStyle(room.theme)}>
      <header className="flex items-center gap-3 border-b-2 border-ink bg-card px-4 py-3">
        {theme.logo ? <Logo src={theme.logo} className="h-7" /> : <span className="text-2xl">{player?.avatar}</span>}
        <span className="truncate font-bold">{player?.nickname}</span>
        <div className="ml-auto flex items-center gap-2">
          {(player?.streak ?? 0) >= 2 && <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">🔥 {player?.streak}</span>}
          <span className="rounded-full bg-secondary px-3 py-1 font-display font-extrabold tabular-nums">{player?.score ?? 0}</span>
        </div>
      </header>

      <main className="flex flex-1 flex-col p-4">
        {room.phase === "lobby" && <Big emoji={player?.avatar ?? "🎉"} title="You're in!" sub="Look for your name on the big screen. Starting soon…" />}

        {(room.phase === "question" || room.phase === "reveal") && q?.type === "content" && (
          <div className="flex flex-1 flex-col justify-center"><ContentSlide q={q} compact /></div>
        )}

        {room.phase === "question" && q && q.type !== "content" && !answered && (
          <div className="flex flex-1 flex-col gap-4" key={room.current_index}>
            <div className="flex items-center gap-3">
              <h1 className="flex-1 font-display text-xl font-bold leading-tight">{q.prompt}</h1>
              <TimerRing seconds={remainingSeconds(room, now)} total={q.timeLimit} />
            </div>
            {q.media?.kind === "image" && <MediaView media={q.media} className="max-h-40" />}
            <AnswerInput key={room.current_index} q={q} room={room} mine={mine.map((m) => m.answer)} sending={sending} send={send} />
          </div>
        )}

        {room.phase === "question" && q && q.type !== "content" && answered && (
          <Big emoji="🙌" title="Locked in!" sub={isScored(q.type) ? "Fingers crossed…" : "Watch the big screen."} />
        )}

        {room.phase === "reveal" && q && q.type !== "content" && (
          <div className="flex flex-1 flex-col gap-4">
            {isScored(q.type) ? (
              mine[0]?.is_correct ? (
                <Big emoji="🎉" title={`+${mine[0].points}`} sub="Nailed it!" tone="bg-success" />
              ) : (
                <Big emoji={mine.length ? "😅" : "⏰"} title={mine.length ? "Not quite" : "Missed it"} sub="Next one's yours." tone="bg-a1" />
              )
            ) : !slideFlag(q, settings, "playerResults") ? (
              <Big emoji="👀" title="Results are up" sub="Check the big screen." />
            ) : null}
            {slideFlag(q, settings, "playerResults") && (
              <div className="card-ink overflow-hidden rounded-3xl p-3">
                <p className="mb-2 text-center font-display font-bold">{q.prompt}</p>
                <div className="origin-top scale-[0.85]"><Results q={q} responses={qResponses} players={players} reveal small /></div>
              </div>
            )}
          </div>
        )}

        {room.phase === "leaderboard" && <Big emoji="🏆" title={rank ? `#${rank}` : "—"} sub={`${player?.score ?? 0} points so far`} />}

        {room.phase === "ended" && (
          settings.endScreen === "message" ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center animate-pop">
              <h1 className="font-display text-4xl font-extrabold">{settings.endTitle}</h1>
              {settings.endMessage && <p className="whitespace-pre-line text-lg">{settings.endMessage}</p>}
              {settings.endImage && <img src={settings.endImage} alt="" className="max-h-60 rounded-2xl border-2 border-ink object-contain" />}
              <Link to="/" className="font-bold underline">Done</Link>
            </div>
          ) : (
            <Big emoji={rank === 1 ? "👑" : "🎊"} title={settings.endScreen === "none" ? "Thanks for joining!" : `You finished #${rank}`} sub={settings.endScreen === "none" ? "" : `${player?.score ?? 0} points · thanks for playing!`} />
          )
        )}
      </main>

      {settings.reactions && room.phase !== "ended" && (
        <div className="sticky bottom-0 flex justify-center gap-2 border-t-2 border-ink bg-card px-3 py-2">
          {REACTIONS.map((e) => (
            <button key={e} onClick={() => react(e)} className="rounded-full px-3 py-1 text-2xl transition-transform active:scale-125" aria-label={`React ${e}`}>{e}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function AnswerInput({ q, room, mine, sending, send }: { q: Question; room: Room; mine: string[]; sending: boolean; send: (a: string) => Promise<boolean> }) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState<string[]>([]);
  const shown = [...mine, ...pending.slice(mine.length)];
  const order0 = shuffledOrder(q.options.length, `${room.id}-${room.current_index}`);
  const [order, setOrder] = useState(order0);

  if (q.type === "cloud" || q.type === "open" || q.type === "typeanswer") {
    const max = q.type === "cloud" ? 24 : q.type === "open" ? 80 : 60;
    return (
      <form className="mt-auto flex flex-col gap-3" onSubmit={async (e) => { e.preventDefault(); const v = text; if (!v.trim()) return; setText(""); setPending((p) => [...p, v.trim()]); if (!(await send(v))) { setText(v); setPending((p) => p.slice(0, -1)); } }}>
        {shown.length > 0 && <div className="flex flex-wrap gap-2">{shown.map((m, i) => <span key={i} className="rounded-full bg-accent px-3 py-1 text-sm font-bold text-accent-foreground">{m}</span>)}</div>}
        {q.type === "open" ? (
          <textarea value={text} autoFocus maxLength={max} rows={3} onChange={(e) => setText(e.target.value)} placeholder="Share your thoughts…" className="rounded-2xl border-2 border-ink bg-card px-4 py-3 text-lg font-semibold outline-none focus:ring-4 focus:ring-ring/30" />
        ) : (
          <input value={text} autoFocus maxLength={max} onChange={(e) => setText(e.target.value)} placeholder={q.type === "cloud" ? "Type a word…" : "Type your answer…"} className="rounded-2xl border-2 border-ink bg-card px-4 py-4 text-center font-display text-2xl font-bold outline-none focus:ring-4 focus:ring-ring/30" />
        )}
        <button disabled={!text.trim()} className="chunky rounded-2xl bg-btn py-4 font-display text-xl font-bold text-btn-foreground">
          {q.type === "cloud" ? `Send (${Math.max(0, 3 - shown.length)} left)` : "Submit"}
        </button>
      </form>
    );
  }

  if (q.type === "scale") {
    const max = q.scaleMax ?? 5;
    return (
      <div className="mt-auto flex flex-col gap-3">
        <div className={cn("grid gap-2", max > 5 ? "grid-cols-5" : "grid-cols-5")}>
          {Array.from({ length: max }, (_, i) => (
            <button key={i} disabled={sending} onClick={() => send(String(i + 1))} className="chunky aspect-square rounded-2xl bg-card font-display text-2xl font-extrabold">{i + 1}</button>
          ))}
        </div>
        <div className="flex justify-between text-sm font-semibold text-muted-foreground"><span>{q.scaleLabels?.[0]}</span><span>{q.scaleLabels?.[1]}</span></div>
      </div>
    );
  }

  if (q.type === "order") {
    const move = (i: number, d: number) => {
      const j = i + d;
      if (j < 0 || j >= order.length) return;
      const n = [...order];
      [n[i], n[j]] = [n[j]!, n[i]!];
      setOrder(n);
      buzz(8);
    };
    return (
      <div className="flex flex-1 flex-col gap-2">
        <p className="text-sm font-semibold text-muted-foreground">Put these in the right order, top to bottom.</p>
        {order.map((oi, i) => (
          <div key={oi} className={cn("chunky flex items-center gap-2 rounded-2xl px-3 py-2 font-bold text-on-answer", ANSWER_COLORS[oi])}>
            <span className="w-6 text-center font-display">{i + 1}</span>
            {optImage(q.options[oi]) && <img src={optImage(q.options[oi])} alt="" className="h-10 w-10 rounded-lg object-cover" />}
            <span className="flex-1">{optText(q.options[oi])}</span>
            <button onClick={() => move(i, -1)} aria-label="Move up" className="rounded-lg bg-card/30 p-2"><ArrowUp size={16} /></button>
            <button onClick={() => move(i, 1)} aria-label="Move down" className="rounded-lg bg-card/30 p-2"><ArrowDown size={16} /></button>
          </div>
        ))}
        <button disabled={sending} onClick={() => send(order.join(","))} className="chunky mt-auto rounded-2xl bg-btn py-4 font-display text-xl font-bold text-btn-foreground">Submit order</button>
      </div>
    );
  }

  return (
    <div className={cn("grid flex-1 gap-3", q.options.length > 4 ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2")}>
      {q.options.map((o, i) => {
        const img = optImage(o);
        return (
          <button
            key={i}
            disabled={sending}
            onClick={() => send(String(i))}
            className={cn("chunky flex min-h-20 items-center gap-3 rounded-3xl px-5 py-4 text-left font-display text-xl font-bold text-on-answer", ANSWER_COLORS[i], img && "flex-col justify-center text-center")}
          >
            {img ? <img src={img} alt="" className="max-h-28 w-full rounded-2xl object-cover" /> : null}
            <span className="flex items-center gap-2"><span className="text-2xl">{ANSWER_SHAPES[i]}</span>{optText(o)}</span>
          </button>
        );
      })}
    </div>
  );
}

function Big({ emoji, title, sub, tone }: { emoji: string; title: string; sub: string; tone?: string }) {
  return (
    <div className={cn("flex flex-1 flex-col items-center justify-center gap-3 rounded-3xl p-6 text-center animate-pop", tone && `${tone} text-on-answer`)}>
      <span className="text-7xl animate-floaty">{emoji}</span>
      <h1 className="font-display text-5xl font-extrabold">{title}</h1>
      {sub && <p className="text-lg opacity-80">{sub}</p>}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-[100dvh] place-items-center p-6 text-center text-lg font-semibold">{children}</div>;
}

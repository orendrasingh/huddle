import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Eye, EyeOff } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ContentSlide } from "@/components/live/ContentSlide";
import { Leaderboard, Logo, MediaView, ReactionsLayer, Results, TimerRing } from "@/components/live/Visuals";
import { TYPE_META, isScored, remainingSeconds, settingsOf, slideFlag, type Player, type SessionSettings } from "@/lib/game";
import { DonateButton } from "@/components/Donate";
import { hostControl } from "@/lib/room.functions";
import { isMuted, play, setMuted } from "@/lib/sound";
import { themeOf, themeStyle } from "@/lib/theme";
import { useNow, useRoomLive } from "@/lib/use-room";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/host/$roomId")({
  head: () => ({
    meta: [
      { title: "Hosting live — huddle" },
      { name: "description", content: "Host view for a live huddle session: PIN, QR code, players and slide controls." },
      { property: "og:title", content: "Hosting a huddle session" },
      { property: "og:description", content: "Live presenter controls for slides, quizzes, polls and word clouds." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Host,
});

type Action = "next" | "reveal" | "leaderboard" | "end";

function Host() {
  const { roomId } = Route.useParams();
  const { room, players, responses, loaded } = useRoomLive(roomId);
  const control = useServerFn(hostControl);
  const now = useNow();
  const [token, setToken] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [muted, setMute] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showLive, setShowLive] = useState(true);
  const prevPlayers = useRef(0);
  const autoRevealed = useRef(-1);
  const lastTick = useRef(-1);

  useEffect(() => {
    setToken(localStorage.getItem(`huddle:host:${roomId}`));
    setOrigin(window.location.origin);
    setMute(isMuted());
  }, [roomId]);

  useEffect(() => {
    if (players.length > prevPlayers.current && prevPlayers.current !== 0) play("join");
    prevPlayers.current = players.length || -1;
  }, [players.length]);

  const [localSettings, setLocalSettings] = useState<Partial<SessionSettings>>({});
  const settings = { ...settingsOf(room?.settings), ...localSettings };
  const q = room ? room.questions?.[room.current_index] : undefined;

  // reset the live-results toggle to the slide's setting whenever the slide changes
  useEffect(() => {
    if (q) setShowLive(slideFlag(q, settings, "liveResults"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.current_index, q?.id]);

  const secs = room && room.phase === "question" ? remainingSeconds(room, now) : 0;
  const qResponses = room ? responses.filter((r) => r.question_index === room.current_index) : [];
  const answeredCount = new Set(qResponses.map((r) => r.player_id)).size;

  async function act(action: Action) {
    if (!token || busy) return;
    setBusy(true);
    try {
      await control({ data: { roomId, hostToken: token, action } });
      if (action === "next") play("start");
      if (action === "leaderboard" || action === "end") play("fanfare");
    } catch {
      toast.error("That didn't go through");
    } finally {
      setBusy(false);
    }
  }
  async function patch(s: Partial<SessionSettings>) {
    if (!token) return;
    const before = localSettings;
    setLocalSettings((p) => ({ ...p, ...s })); // flip instantly, sync in background
    try { await control({ data: { roomId, hostToken: token, action: "settings", settings: s } }); } catch { setLocalSettings(before); toast.error("Couldn't update"); }
  }

  useEffect(() => {
    if (!room || room.phase !== "question" || !q || q.type === "content") return;
    if (secs != null && secs <= 5 && secs > 0 && secs !== lastTick.current) { lastTick.current = secs; play("tick"); }
    const multi = q.type === "cloud" || q.type === "open";
    const allIn = !multi && players.length > 0 && answeredCount >= players.length;
    if ((secs === 0 || allIn) && autoRevealed.current !== room.current_index) {
      autoRevealed.current = room.current_index;
      void act("reveal");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secs, answeredCount, room?.phase, room?.current_index]);

  if (!loaded) return <Center>Loading…</Center>;
  if (!room) return <Center>Room not found. <Link to="/create" className="underline">Create one</Link></Center>;
  if (!token) return <Center>This screen belongs to the host. <Link to="/join" search={{ pin: room.pin }} className="underline">Join as a player instead</Link></Center>;

  const theme = themeOf(room.theme);
  const joinUrl = `${origin}/join?pin=${room.pin}`;
  const isLast = room.current_index >= room.questions.length - 1;
  const nextLabel = isLast ? "Finish 🎉" : "Next ▶";
  const primaryBtn = "chunky rounded-full bg-btn px-6 py-3 font-display font-bold text-btn-foreground";

  return (
    <div className="flex min-h-screen flex-col" style={themeStyle(room.theme)}>
      {settings.reactions && <ReactionsLayer roomId={roomId} />}
      <header className="flex flex-wrap items-center gap-3 border-b-2 border-ink bg-card px-6 py-3">
        <Logo src={theme.logo || undefined} />
        <span className="truncate font-display text-lg font-bold">{room.title}</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {room.phase !== "lobby" && (
            <span className="rounded-full border-2 border-ink bg-background px-3 py-1 text-sm font-bold">
              PIN <span className="font-display tracking-widest">{room.pin}</span>
            </span>
          )}
          <span className="rounded-full bg-secondary px-3 py-1 text-sm font-bold">👥 {players.length}</span>
          <button onClick={() => patch({ reactions: !settings.reactions })} className={cn("rounded-full border-2 border-ink px-3 py-1 text-sm font-bold", settings.reactions ? "bg-accent text-accent-foreground" : "bg-card")} title="Toggle live reactions">
            {settings.reactions ? "❤️ Reactions on" : "Reactions off"}
          </button>
          <DonateButton label="Support" className="hidden md:inline-flex" />
          <button onClick={() => { setMuted(!muted); setMute(!muted); }} className="rounded-full px-2 text-xl" aria-label="Toggle sound">
            {muted ? "🔇" : "🔊"}
          </button>
        </div>
      </header>

      <main className="flex flex-1 flex-col px-6 py-8">
        {room.phase === "lobby" && (
          <div className="mx-auto grid w-full max-w-6xl flex-1 items-start gap-10 lg:grid-cols-[auto_1fr]">
            <div className="card-ink flex flex-col items-center gap-4 rounded-3xl p-8 animate-pop">
              <p className="text-sm font-bold text-muted-foreground">Join at <span className="text-foreground">{origin.replace(/^https?:\/\//, "")}/join</span></p>
              <p className="font-display text-7xl font-extrabold tracking-[0.12em]">{room.pin}</p>
              <div className="rounded-2xl border-2 border-ink bg-card p-3">
                {origin && <QRCodeSVG value={joinUrl} size={200} bgColor="transparent" fgColor="currentColor" />}
              </div>
              <p className="text-sm text-muted-foreground">Scan to join — no app needed</p>
            </div>
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h1 className="font-display text-4xl font-extrabold">
                  {players.length ? `${players.length} ${players.length === 1 ? "person" : "people"} in` : "Waiting for the crowd…"}
                </h1>
                <button onClick={() => act("next")} disabled={busy} className={cn(primaryBtn, "px-8 text-xl")}>Start ▶</button>
              </div>
              <div className="flex flex-wrap gap-3">
                {players.map((p) => (
                  <span key={p.id} className="card-ink animate-pop flex items-center gap-2 rounded-full px-4 py-2 text-lg font-bold">
                    <span className="text-2xl">{p.avatar}</span>{p.nickname}
                  </span>
                ))}
                {!players.length && <p className="text-lg text-muted-foreground animate-floaty">Share the PIN or QR code 👈</p>}
              </div>
            </div>
          </div>
        )}

        {(room.phase === "question" || room.phase === "reveal") && q?.type === "content" && (
          <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6">
            <ContentSlide q={q} />
            <div className="flex justify-end">
              <button onClick={() => act("next")} disabled={busy} className={primaryBtn}>{nextLabel}</button>
            </div>
          </div>
        )}

        {(room.phase === "question" || room.phase === "reveal") && q && q.type !== "content" && (
          <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border-2 border-ink bg-card px-3 py-1 text-sm font-bold">
                {room.current_index + 1}/{room.questions.length} · {TYPE_META[q.type].emoji} {TYPE_META[q.type].label}
              </span>
              {room.phase === "question" && (
                <button onClick={() => setShowLive((v) => !v)} className="flex items-center gap-1 rounded-full border-2 border-ink bg-card px-3 py-1 text-sm font-bold">
                  {showLive ? <Eye size={14} /> : <EyeOff size={14} />} Live results {showLive ? "on" : "off"}
                </button>
              )}
              <span className="ml-auto text-sm font-bold text-muted-foreground">{answeredCount}/{players.length} answered</span>
              {room.phase === "question" && <TimerRing seconds={secs} total={q.timeLimit} />}
            </div>
            <h1 className="text-center font-display text-4xl font-extrabold leading-tight sm:text-5xl">{q.prompt}</h1>
            {q.body && <p className="whitespace-pre-line text-center text-lg text-muted-foreground">{q.body}</p>}
            {q.media && <MediaView media={q.media} className="max-h-64" />}
            <div className="card-ink rounded-3xl p-6">
              {room.phase === "question" && (!showLive || q.type === "quiz" || q.type === "truefalse" || q.type === "typeanswer" || q.type === "order") ? (
                <div className="grid h-56 place-items-center text-center">
                  <div>
                    <p className="font-display text-8xl font-extrabold tabular-nums animate-pop" key={answeredCount}>{answeredCount}</p>
                    <p className="text-muted-foreground">answers locked in</p>
                  </div>
                </div>
              ) : (
                <Results q={q} responses={qResponses} players={players} reveal={room.phase === "reveal"} />
              )}
            </div>
            <div className="flex justify-end gap-3">
              {room.phase === "question" ? (
                <button onClick={() => act("reveal")} disabled={busy} className="chunky rounded-full bg-accent px-6 py-3 font-display font-bold text-accent-foreground">
                  {isScored(q.type) ? "Reveal answer" : "Stop & show results"}
                </button>
              ) : isScored(q.type) && slideFlag(q, settings, "leaderboard") ? (
                <button onClick={() => act("leaderboard")} disabled={busy} className={primaryBtn}>Leaderboard 🏆</button>
              ) : (
                <button onClick={() => act("next")} disabled={busy} className={primaryBtn}>{nextLabel}</button>
              )}
            </div>
          </div>
        )}

        {room.phase === "leaderboard" && (
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
            <h1 className="text-center font-display text-5xl font-extrabold">Leaderboard 🏆</h1>
            <Leaderboard players={players} />
            <div className="flex justify-end">
              <button onClick={() => act("next")} disabled={busy} className={primaryBtn}>{nextLabel}</button>
            </div>
          </div>
        )}

        {room.phase === "ended" && <EndScreen settings={settings} players={players} />}
      </main>

      {room.phase !== "ended" && room.phase !== "lobby" && (
        <footer className="flex justify-between px-6 pb-4 text-sm">
          <button onClick={() => act("end")} className="text-muted-foreground underline-offset-4 hover:underline">End session</button>
        </footer>
      )}
    </div>
  );
}

function EndScreen({ settings, players }: { settings: SessionSettings; players: Player[] }) {
  const again = <Link to="/dashboard" className="chunky rounded-full bg-card px-6 py-3 font-bold">Back to my sessions</Link>;
  if (settings.endScreen === "none") return <div className="grid flex-1 place-items-center">{again}</div>;
  if (settings.endScreen === "message")
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-6 text-center animate-pop">
        <h1 className="font-display text-6xl font-extrabold">{settings.endTitle}</h1>
        {settings.endMessage && <p className="whitespace-pre-line text-2xl">{settings.endMessage}</p>}
        {settings.endImage && <img src={settings.endImage} alt="" className="max-h-80 rounded-3xl border-2 border-ink object-contain" />}
        {again}
      </div>
    );
  if (settings.endScreen === "leaderboard")
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-8">
        <h1 className="font-display text-5xl font-extrabold">{settings.endTitle}</h1>
        <Leaderboard players={players} limit={10} />
        {again}
      </div>
    );
  return <Podium players={players} title={settings.endTitle} again={again} />;
}

function Podium({ players, title, again }: { players: Player[]; title: string; again: React.ReactNode }) {
  const top = [...players].sort((a, b) => b.score - a.score).slice(0, 3);
  const order = [top[1], top[0], top[2]];
  const heights = ["h-40", "h-56", "h-28"];
  const places = ["2", "1", "3"];
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-10">
      <h1 className="font-display text-6xl font-extrabold animate-pop">{title}</h1>
      <div className="flex items-end gap-4">
        {order.map((p, i) =>
          p ? (
            <div key={p.id} className="flex w-40 flex-col items-center gap-2 animate-pop" style={{ animationDelay: `${[400, 800, 0][i]}ms` }}>
              <span className="text-5xl animate-floaty">{p.avatar}</span>
              <span className="truncate font-bold">{p.nickname}</span>
              <span className="font-display font-extrabold tabular-nums">{p.score}</span>
              <div className={`chunky w-full rounded-t-2xl ${heights[i]} ${["bg-a2", "bg-a3", "bg-a1"][i]} grid place-items-start justify-center pt-3 font-display text-4xl font-extrabold`}>
                {places[i]}
              </div>
            </div>
          ) : (
            <div key={i} className="w-40" />
          ),
        )}
      </div>
      {again}
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-screen place-items-center p-6 text-center text-lg font-semibold">{children}</div>;
}

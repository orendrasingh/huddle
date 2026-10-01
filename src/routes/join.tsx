import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Logo } from "@/components/live/Visuals";
import { AVATARS } from "@/lib/game";
import { joinRoom } from "@/lib/room.functions";
import { buzz, play } from "@/lib/sound";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/join")({
  validateSearch: z.object({ pin: z.coerce.string().optional() }),
  head: () => ({
    meta: [
      { title: "Join a session — huddle" },
      { name: "description", content: "Enter a game PIN and pick a nickname to join a live huddle session. No account needed." },
      { property: "og:title", content: "Join a huddle session" },
      { property: "og:description", content: "Enter the PIN, pick a nickname, you're in." },
    ],
  }),
  component: Join,
});

function Join() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const join = useServerFn(joinRoom);
  const [pin, setPin] = useState(search.pin ?? "");
  const [nick, setNick] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await join({ data: { pin, nickname: nick, avatar } });
      if ("error" in res) {
        toast.error(res.error);
        play("wrong");
        buzz([30, 40, 30]);
        return;
      }
      localStorage.setItem(`huddle:player:${res.roomId}`, JSON.stringify({ playerId: res.playerId, token: res.token }));
      play("join");
      navigate({ to: "/play/$roomId", params: { roomId: res.roomId } });
    } catch {
      toast.error("Couldn't join right now");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-6">
      <Link to="/"><Logo /></Link>
      <form onSubmit={submit} className="card-ink mt-8 flex flex-col gap-5 rounded-3xl p-6 animate-pop">
        <h1 className="font-display text-3xl font-extrabold">Jump in 👋</h1>
        <label className="flex flex-col gap-1 text-sm font-bold">
          Game PIN
          <input
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="rounded-2xl border-2 border-ink bg-background px-4 py-3 text-center font-display text-2xl tracking-[0.3em] outline-none focus:ring-4 focus:ring-ring/30"
            placeholder="000000"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold">
          Nickname
          <input
            value={nick}
            autoFocus={!!search.pin}
            maxLength={20}
            onChange={(e) => setNick(e.target.value)}
            className="rounded-2xl border-2 border-ink bg-background px-4 py-3 text-lg font-semibold outline-none focus:ring-4 focus:ring-ring/30"
            placeholder="What should we call you?"
          />
        </label>
        <div>
          <p className="mb-2 text-sm font-bold">Pick a buddy</p>
          <div className="grid grid-cols-8 gap-2">
            {AVATARS.map((a) => (
              <button
                type="button"
                key={a}
                onClick={() => { setAvatar(a); play("tap"); buzz(10); }}
                className={cn(
                  "grid aspect-square place-items-center rounded-xl border-2 text-2xl transition-transform",
                  a === avatar ? "scale-110 border-ink bg-accent" : "border-transparent hover:scale-105",
                )}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
        <button disabled={busy || pin.length !== 6 || !nick.trim()} className="chunky rounded-2xl bg-primary py-4 font-display text-xl font-bold text-primary-foreground">
          {busy ? "Joining…" : "Let's go!"}
        </button>
      </form>
    </div>
  );
}

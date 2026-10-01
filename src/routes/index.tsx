import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { DonateButton, DONATE_URL } from "@/components/Donate";
import { Logo } from "@/components/live/Visuals";
import { ANSWER_COLORS, ANSWER_SHAPES, TYPE_META } from "@/lib/game";
import { play } from "@/lib/sound";
import { useUser } from "@/lib/use-auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "huddle — Live Quiz, Poll & Word Cloud App for Any Crowd" },
      { name: "description", content: "Run live trivia, polls and word clouds your crowd joins by game PIN from any phone. Perfect for parties, all-hands and workshops. Free and open source." },
      { property: "og:title", content: "huddle — Live Quiz, Poll & Word Cloud App for Any Crowd" },
      { property: "og:description", content: "Run live trivia, polls and word clouds your crowd joins by game PIN from any phone. Perfect for parties, all-hands and workshops. Free and open source." },
    ],
  }),
  component: Home,
});

function Home() {
  const [pin, setPin] = useState("");
  const navigate = useNavigate();
  const { user } = useUser();
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <div className="flex items-center gap-2">
          <DonateButton label="Sponsor" className="hidden sm:inline-flex" />
          {user ? (
            <Link to="/dashboard" className="rounded-full px-4 py-2 font-bold hover:bg-secondary">My sessions</Link>
          ) : (
            <Link to="/auth" className="rounded-full px-4 py-2 font-bold hover:bg-secondary">Sign in</Link>
          )}
          <Link to={user ? "/dashboard" : "/create"} className="chunky rounded-full bg-card px-5 py-2 font-bold">
            Host a session
          </Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-8 lg:grid-cols-[1.1fr_1fr]">
        <section>
          <p className="mb-4 inline-block rounded-full border-2 border-ink bg-accent px-3 py-1 text-sm font-bold">
            Free & open source · no sign-up to play
          </p>
          <h1 className="font-display text-5xl font-extrabold leading-[0.95] sm:text-7xl">
            Get the whole room <span className="text-primary">talking</span>.
          </h1>
          <p className="mt-5 max-w-lg text-lg text-muted-foreground">
            Slides, trivia, polls, word clouds and more for team all-hands, birthday parties, workshops and community nights. Everyone joins from their phone in seconds.
          </p>

          <form
            className="card-ink mt-8 flex max-w-md flex-col gap-3 rounded-3xl p-4 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (pin.length === 6) {
                play("tap");
                navigate({ to: "/join", search: { pin } });
              }
            }}
          >
            <input
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="Game PIN"
              aria-label="Game PIN"
              className="min-w-0 flex-1 rounded-2xl border-2 border-ink bg-background px-4 py-3 text-center font-display text-2xl font-bold tracking-[0.3em] outline-none focus:ring-4 focus:ring-ring/30"
            />
            <button type="submit" disabled={pin.length !== 6} className="chunky rounded-2xl bg-primary px-6 py-3 font-display text-lg font-bold text-primary-foreground">
              Join
            </button>
          </form>
        </section>

        <section className="relative">
          <div className="card-ink rotate-1 rounded-3xl p-6">
            <div className="mb-4 flex items-center justify-between">
              <span className="rounded-full bg-secondary px-3 py-1 text-sm font-bold">⚡ Trivia · 0:12</span>
              <span className="text-sm font-semibold text-muted-foreground">24 answered</span>
            </div>
            <p className="mb-5 font-display text-2xl font-bold">Which planet has the most moons?</p>
            <div className="grid grid-cols-2 gap-3">
              {["Earth", "Saturn", "Mars", "Venus"].map((o, i) => (
                <div key={o} className={cn("chunky flex items-center gap-2 rounded-2xl px-4 py-4 font-bold text-on-answer", ANSWER_COLORS[i])}>
                  <span>{ANSWER_SHAPES[i]}</span>
                  {o}
                </div>
              ))}
            </div>
          </div>
          <div className="card-ink absolute -bottom-8 -left-4 -rotate-3 rounded-2xl px-4 py-3 font-display font-bold animate-floaty">
            🔥 3 streak · +1,340
          </div>
        </section>
      </main>

      <section className="mx-auto grid max-w-6xl gap-5 px-6 pb-24 sm:grid-cols-3">
        {Object.entries(TYPE_META).map(([k, m]) => (
          <div key={k} className="card-ink rounded-3xl p-6">
            <div className="text-4xl">{m.emoji}</div>
            <h2 className="mt-3 font-display text-2xl font-extrabold">{m.label}</h2>
            <p className="mt-1 text-muted-foreground">{m.blurb}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="card-ink flex flex-col items-start gap-5 rounded-3xl bg-accent p-8 sm:flex-row sm:items-center">
          <div className="text-5xl">💛</div>
          <div className="flex-1">
            <h2 className="font-display text-3xl font-extrabold">Free forever, powered by people like you</h2>
            <p className="mt-1 max-w-2xl">No ads, no paywalls, no tracking. huddle is open source and runs on community support. If it made your event better, consider sponsoring.</p>
          </div>
          <a href={DONATE_URL} target="_blank" rel="noopener noreferrer" className="chunky rounded-full bg-btn px-6 py-3 font-display text-lg font-bold text-btn-foreground">Sponsor huddle</a>
        </div>
      </section>
    </div>
  );
}

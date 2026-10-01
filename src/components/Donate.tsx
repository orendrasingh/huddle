import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export const DONATE_URL = (import.meta.env['VITE_DONATE_URL'] as string | undefined) || "https://github.com/sponsors/orendrasingh";
const KEY = "huddle:donate-seen";
const EVERY = 14 * 24 * 60 * 60 * 1000;

/** Small heart link for headers and the host bar. */
export function DonateButton({ className, label = "Support huddle" }: { className?: string; label?: string }) {
  return (
    <a href={DONATE_URL} target="_blank" rel="noopener noreferrer" className={cn("inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-card px-3 py-1 text-sm font-bold hover:bg-accent", className)}>
      <span aria-hidden>💛</span> {label}
    </a>
  );
}

/** Friendly one-time (then every 2 weeks) ask shown when someone starts hosting. */
export function DonatePrompt() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const last = Number(localStorage.getItem(KEY) || 0);
    if (Date.now() - last > EVERY) setOpen(true);
  }, []);
  if (!open) return null;
  const close = () => { localStorage.setItem(KEY, String(Date.now())); setOpen(false); };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" role="dialog" aria-modal="true" aria-labelledby="donate-title" onClick={close}>
      <div className="card-ink w-full max-w-md rounded-3xl p-6 animate-pop" onClick={(e) => e.stopPropagation()}>
        <div className="text-5xl">💛</div>
        <h2 id="donate-title" className="mt-3 font-display text-3xl font-extrabold">Keep huddle free for everyone</h2>
        <p className="mt-2 text-muted-foreground">
          huddle is open source with no ads and no paywalls. If it brings your crowd together, a small sponsorship helps cover servers and keeps it free.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a href={DONATE_URL} target="_blank" rel="noopener noreferrer" onClick={close} className="chunky rounded-full bg-btn px-6 py-3 font-display font-bold text-btn-foreground">
            Sponsor huddle
          </a>
          <button onClick={close} className="rounded-full px-5 py-3 font-bold hover:bg-secondary">Maybe later</button>
        </div>
      </div>
    </div>
  );
}

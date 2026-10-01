import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Switch } from "@/components/ui/switch";
import { Logo, MediaView } from "@/components/live/Visuals";
import { ImageField, ImageUrlField, MediaField } from "./MediaField";
import {
  ANSWER_COLORS, ANSWER_SHAPES, TYPE_META, convertQuestion, hasOptions, isScored, newQuestion, settingsOf, uid,
  type ActivityType, type Question, type SessionSettings, type SlideOverrides, type Theme,
} from "@/lib/game";
import { DEFAULT_ANSWERS, PRESETS, themeOf, themeStyle } from "@/lib/theme";
import { play } from "@/lib/sound";
import { cn } from "@/lib/utils";

export interface Draft {
  title: string;
  questions: Question[];
  theme: Partial<Theme>;
  settings: Partial<SessionSettings>;
}

const TIMES: (number | null)[] = [null, 5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 300];
const TYPES = Object.keys(TYPE_META) as ActivityType[];

export function validateDraft(d: Draft): string[] {
  const errs: string[] = [];
  if (!d.questions.length) errs.push("Add at least one slide");
  d.questions.forEach((x, i) => {
    const n = `Slide ${i + 1}`;
    if (!x.prompt.trim() && !(x.type === "content" && (x.body?.trim() || x.media))) errs.push(`${n} needs a title or question`);
    if (hasOptions(x.type) && x.options.filter((o) => o.text.trim() || o.image).length < 2) errs.push(`${n} needs 2+ answers`);
    if ((x.type === "quiz" || x.type === "truefalse") && !(x.options[x.correct]?.text.trim() || x.options[x.correct]?.image)) errs.push(`${n}: pick a correct answer`);
    if (x.type === "typeanswer" && !x.accepted?.some((a) => a.trim())) errs.push(`${n} needs an accepted answer`);
    if (x.type === "order" && x.options.some((o) => !o.text.trim() && !o.image)) errs.push(`${n}: fill in every puzzle item`);
  });
  return errs;
}

/** Strips empty answers so the live room gets clean data. */
export function cleanQuestions(qs: Question[]): Question[] {
  return qs.map((x) => {
    const base = { ...x, prompt: x.prompt.trim() || (x.type === "content" ? " " : x.prompt) };
    if (!hasOptions(x.type)) return { ...base, options: [], accepted: x.accepted?.map((a) => a.trim()).filter(Boolean) };
    const kept = x.options.map((o, i) => ({ o: { text: o.text.trim(), ...(o.image ? { image: o.image } : {}) }, i })).filter((y) => y.o.text || y.o.image);
    return { ...base, options: kept.map((y) => y.o), correct: Math.max(0, kept.findIndex((y) => y.i === x.correct)) };
  });
}

export function Editor({ value, onChange, canUpload, headerRight, status }: { value: Draft; onChange: (d: Draft) => void; canUpload: boolean; headerRight: ReactNode; status?: ReactNode }) {
  const [sel, setSel] = useState(0);
  const [tab, setTab] = useState<"slide" | "theme" | "session">("slide");
  const qs = value.questions;
  const q = qs[sel];
  const settings = settingsOf(value.settings);
  const theme = themeOf(value.theme);

  const setQs = (next: Question[]) => onChange({ ...value, questions: next });
  const update = (patch: Partial<Question>) => setQs(qs.map((x, i) => (i === sel ? { ...x, ...patch } : x)));
  const setTheme = (patch: Partial<Theme>) => onChange({ ...value, theme: { ...theme, ...patch } });
  const setSettings = (patch: Partial<SessionSettings>) => onChange({ ...value, settings: { ...settings, ...patch } });

  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= qs.length) return;
    const next = [...qs];
    [next[i], next[j]] = [next[j]!, next[i]!];
    setQs(next);
    setSel(j);
    play("tap");
  };
  const add = (t: ActivityType) => {
    setQs([...qs, newQuestion(t)]);
    setSel(qs.length);
    setTab("slide");
    play("tap");
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b-2 border-ink bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-5 py-3">
          <input
            value={value.title}
            onChange={(e) => onChange({ ...value, title: e.target.value })}
            placeholder="Name your session"
            maxLength={80}
            className="min-w-0 flex-1 rounded-xl bg-transparent px-3 py-2 font-display text-xl font-bold outline-none hover:bg-secondary focus:bg-secondary"
          />
          {status && <span className="hidden text-xs font-semibold text-muted-foreground sm:inline">{status}</span>}
          {headerRight}
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-5 py-6 lg:grid-cols-[280px_1fr]">
        <aside className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-1 rounded-full border-2 border-ink bg-card p-1 text-sm font-bold">
            {(["slide", "theme", "session"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={cn("rounded-full py-1.5 capitalize", tab === t ? "bg-ink text-background" : "hover:bg-secondary")}>
                {t === "slide" ? "Slides" : t}
              </button>
            ))}
          </div>
          {qs.map((x, i) => (
            <div
              key={x.id}
              role="button"
              tabIndex={0}
              onClick={() => { setSel(i); setTab("slide"); }}
              onKeyDown={(e) => e.key === "Enter" && setSel(i)}
              className={cn(
                "group rounded-2xl border-2 border-ink p-3 text-left transition-all",
                i === sel && tab === "slide" ? "bg-accent shadow-[0_4px_0_0_var(--ink)]" : "bg-card hover:-translate-y-0.5",
              )}
            >
              <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                <span>{i + 1}</span>
                <span>{TYPE_META[x.type].emoji} {TYPE_META[x.type].label}</span>
                <span className="ml-auto">{x.timeLimit ? `${x.timeLimit}s` : "∞"}</span>
              </div>
              <p className="mt-1 line-clamp-2 font-semibold">{x.prompt.trim() || <span className="text-muted-foreground">Untitled</span>}</p>
              <div className="mt-2 flex gap-1 opacity-60 group-hover:opacity-100">
                <IconBtn label="Move up" onClick={(e) => { e.stopPropagation(); move(i, -1); }}><ArrowUp size={14} /></IconBtn>
                <IconBtn label="Move down" onClick={(e) => { e.stopPropagation(); move(i, 1); }}><ArrowDown size={14} /></IconBtn>
                <IconBtn label="Duplicate" onClick={(e) => { e.stopPropagation(); setQs([...qs.slice(0, i + 1), { ...x, id: uid() }, ...qs.slice(i + 1)]); setSel(i + 1); }}><Copy size={14} /></IconBtn>
                <IconBtn label="Delete" onClick={(e) => { e.stopPropagation(); setQs(qs.filter((_, k) => k !== i)); setSel(Math.max(0, Math.min(sel, qs.length - 2))); }}><Trash2 size={14} /></IconBtn>
              </div>
            </div>
          ))}
          <p className="mt-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Add slide</p>
          <div className="grid grid-cols-3 gap-2">
            {TYPES.map((t) => (
              <button key={t} onClick={() => add(t)} className="chunky flex flex-col items-center gap-0.5 rounded-xl bg-card px-1 py-2 text-[11px] font-bold leading-tight">
                <span className="text-lg">{TYPE_META[t].emoji}</span>
                {TYPE_META[t].label}
              </button>
            ))}
          </div>
        </aside>

        {tab === "theme" ? (
          <ThemePanel theme={theme} setTheme={setTheme} canUpload={canUpload} title={value.title} />
        ) : tab === "session" ? (
          <SessionPanel settings={settings} setSettings={setSettings} canUpload={canUpload} />
        ) : q ? (
          <SlidePanel key={q.id} q={q} update={update} settings={settings} canUpload={canUpload} />
        ) : (
          <section className="grid place-items-center rounded-3xl border-2 border-dashed border-ink p-12 text-muted-foreground">
            <div className="flex flex-col items-center gap-3">Add a slide to get started <Plus /></div>
          </section>
        )}
      </div>
    </div>
  );
}

function SlidePanel({ q, update, settings, canUpload }: { q: Question; update: (p: Partial<Question>) => void; settings: SessionSettings; canUpload: boolean }) {
  const setOpt = (i: number, patch: Partial<{ text: string; image: string }>) =>
    update({ options: q.options.map((o, k) => (k === i ? { ...o, ...patch } : o)) });
  const maxOpts = q.type === "truefalse" ? 2 : 6;
  const minOpts = 2;

  return (
    <section className="card-ink flex flex-col gap-6 rounded-3xl p-6 animate-pop">
      <div className="flex flex-wrap gap-2">
        {TYPES.map((t) => (
          <button
            key={t}
            onClick={() => update(convertQuestion(q, t))}
            className={cn("rounded-full border-2 border-ink px-3 py-1 text-sm font-bold transition-colors", q.type === t ? "bg-ink text-background" : "bg-card hover:bg-secondary")}
          >
            {TYPE_META[t].emoji} {TYPE_META[t].label}
          </button>
        ))}
      </div>

      <textarea
        value={q.prompt}
        onChange={(e) => update({ prompt: e.target.value })}
        maxLength={300}
        rows={2}
        placeholder={q.type === "content" ? "Slide title" : q.type === "cloud" ? "Ask for a word or two…" : "Type your question…"}
        className="w-full resize-none rounded-2xl border-2 border-ink bg-background px-5 py-4 text-center font-display text-3xl font-bold outline-none focus:ring-4 focus:ring-ring/30"
      />

      <div className="flex flex-col gap-3">
        <textarea
          value={q.body ?? ""}
          onChange={(e) => update({ body: e.target.value })}
          maxLength={2000}
          rows={q.type === "content" ? 5 : 2}
          placeholder={q.type === "content" ? "Text, bullet points, notes… (new line = new line)" : "Extra text (optional)"}
          className="w-full resize-y rounded-2xl border-2 border-ink bg-background px-4 py-3 outline-none focus:ring-4 focus:ring-ring/30"
        />
        <MediaField value={q.media} onChange={(m) => update({ media: m })} canUpload={canUpload} />
        {q.media && <MediaView media={q.media} className="max-h-48" />}
      </div>

      {q.type === "content" && (
        <Field label="Layout">
          <Pills
            value={q.layout ?? "center"}
            options={[["center", "Centered"], ["left", "Media left"], ["right", "Media right"], ["full", "Full media"]]}
            onChange={(v) => update({ layout: v as Question["layout"] })}
          />
        </Field>
      )}

      {hasOptions(q.type) && (
        <div className="flex flex-col gap-2">
          {q.type === "order" && <p className="text-sm font-semibold text-muted-foreground">Enter items in the <b>correct</b> order — players see them shuffled.</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            {q.options.map((o, i) => (
              <div key={i} className={cn("flex items-center gap-2 rounded-2xl border-2 border-ink p-2 text-on-answer", ANSWER_COLORS[i])}>
                <span className="w-6 text-center text-lg">{q.type === "order" ? i + 1 : ANSWER_SHAPES[i]}</span>
                <input
                  value={o.text}
                  maxLength={120}
                  readOnly={q.type === "truefalse"}
                  onChange={(e) => setOpt(i, { text: e.target.value })}
                  placeholder={`Answer ${i + 1}`}
                  className="min-w-0 flex-1 rounded-xl bg-card px-3 py-2 font-semibold text-foreground outline-none"
                />
                {q.type !== "truefalse" && <ImageField value={o.image} onChange={(url) => setOpt(i, { image: url })} canUpload={canUpload} label="answer image" />}
                {(q.type === "quiz" || q.type === "truefalse") && (
                  <button
                    onClick={() => update({ correct: i })}
                    aria-label="Mark correct"
                    className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-ink font-bold", q.correct === i ? "bg-success text-on-answer" : "bg-card text-muted-foreground")}
                  >
                    ✓
                  </button>
                )}
                {q.type !== "truefalse" && q.options.length > minOpts && (
                  <button onClick={() => update({ options: q.options.filter((_, k) => k !== i), correct: q.correct >= i && q.correct > 0 ? q.correct - 1 : q.correct })} aria-label="Remove" className="px-1 opacity-80 hover:opacity-100">
                    ✕
                  </button>
                )}
              </div>
            ))}
            {q.options.length < maxOpts && (
              <button onClick={() => update({ options: [...q.options, { text: "" }] })} className="rounded-2xl border-2 border-dashed border-ink p-3 font-bold text-muted-foreground hover:bg-secondary">
                + Add {q.type === "order" ? "item" : "answer"}
              </button>
            )}
          </div>
        </div>
      )}

      {q.type === "typeanswer" && (
        <Field label="Accepted answers (not case-sensitive)">
          <div className="flex flex-wrap gap-2">
            {(q.accepted ?? [""]).map((a, i) => (
              <div key={i} className="flex items-center gap-1 rounded-full border-2 border-ink bg-background pl-3">
                <input value={a} maxLength={80} placeholder="Answer" onChange={(e) => update({ accepted: (q.accepted ?? [""]).map((y, k) => (k === i ? e.target.value : y)) })} className="w-40 bg-transparent py-1.5 outline-none" />
                {(q.accepted?.length ?? 0) > 1 && <button onClick={() => update({ accepted: q.accepted!.filter((_, k) => k !== i) })} className="px-2" aria-label="Remove">✕</button>}
              </div>
            ))}
            {(q.accepted?.length ?? 0) < 10 && <button onClick={() => update({ accepted: [...(q.accepted ?? []), ""] })} className="rounded-full border-2 border-dashed border-ink px-3 py-1.5 text-sm font-bold">+ spelling</button>}
          </div>
        </Field>
      )}

      {q.type === "scale" && (
        <Field label="Scale">
          <div className="flex flex-wrap items-center gap-3">
            <Pills value={String(q.scaleMax ?? 5)} options={[["5", "1–5"], ["10", "1–10"]]} onChange={(v) => update({ scaleMax: Number(v) })} />
            <input value={q.scaleLabels?.[0] ?? ""} maxLength={40} placeholder="Low label" onChange={(e) => update({ scaleLabels: [e.target.value, q.scaleLabels?.[1] ?? ""] })} className="rounded-xl border-2 border-ink bg-background px-3 py-1.5 outline-none" />
            <input value={q.scaleLabels?.[1] ?? ""} maxLength={40} placeholder="High label" onChange={(e) => update({ scaleLabels: [q.scaleLabels?.[0] ?? "", e.target.value] })} className="rounded-xl border-2 border-ink bg-background px-3 py-1.5 outline-none" />
          </div>
        </Field>
      )}

      {q.type === "cloud" && (
        <Toggle label="Show as a live wall of answers instead of a cloud" checked={!!q.wall} onChange={(v) => update({ wall: v })} />
      )}

      {q.type !== "content" && (
        <>
          <Field label="Timer">
            <div className="flex flex-wrap gap-2">
              {TIMES.map((t) => (
                <button key={String(t)} onClick={() => update({ timeLimit: t })} className={cn("rounded-full border-2 border-ink px-3 py-1 text-sm font-bold", q.timeLimit === t ? "bg-primary text-primary-foreground" : "bg-card hover:bg-secondary")}>
                  {t == null ? "No timer" : t >= 60 ? `${t / 60}m` : `${t}s`}
                </button>
              ))}
            </div>
          </Field>
          <Field label="For this slide">
            <div className="grid gap-2 sm:grid-cols-3">
              <Override label="Live results on screen" k="liveResults" q={q} s={settings} update={update} />
              <Override label="Results on phones" k="playerResults" q={q} s={settings} update={update} />
              {isScored(q.type) && <Override label="Leaderboard after" k="leaderboard" q={q} s={settings} update={update} />}
            </div>
          </Field>
        </>
      )}
    </section>
  );
}

function Override({ label, k, q, s, update }: { label: string; k: keyof SlideOverrides; q: Question; s: SessionSettings; update: (p: Partial<Question>) => void }) {
  const cur = q.overrides?.[k];
  const val = cur === undefined ? "default" : cur ? "on" : "off";
  return (
    <label className="flex flex-col gap-1 rounded-2xl border-2 border-ink bg-background p-2 text-sm font-bold">
      {label}
      <select
        value={val}
        onChange={(e) => {
          const v = e.target.value;
          update({ overrides: { ...q.overrides, [k]: v === "default" ? undefined : v === "on" } });
        }}
        className="rounded-lg bg-secondary px-2 py-1 font-semibold outline-none"
      >
        <option value="default">Session default ({s[k] ? "on" : "off"})</option>
        <option value="on">On</option>
        <option value="off">Off</option>
      </select>
    </label>
  );
}

function ThemePanel({ theme, setTheme, canUpload, title }: { theme: Theme; setTheme: (p: Partial<Theme>) => void; canUpload: boolean; title: string }) {
  return (
    <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
      <div className="card-ink flex flex-col gap-5 rounded-3xl p-6">
        <h2 className="font-display text-2xl font-extrabold">Look & feel</h2>
        <Field label="Presets">
          <div className="flex flex-wrap gap-2">
            {Object.entries(PRESETS).map(([name, p]) => (
              <button key={name} onClick={() => setTheme({ preset: name, ...p })} className={cn("flex items-center gap-2 rounded-full border-2 border-ink px-3 py-1 text-sm font-bold", theme.preset === name ? "bg-ink text-background" : "bg-card")}>
                <span className="flex">{[p.primary, p.accent, p.background].map((c) => <span key={c} className="-ml-1 h-4 w-4 rounded-full border border-ink first:ml-0" style={{ background: c }} />)}</span>
                {name}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Color label="Main colour" value={theme.primary} onChange={(v) => setTheme({ primary: v, preset: "Custom" })} />
          <Color label="Accent" value={theme.accent} onChange={(v) => setTheme({ accent: v, preset: "Custom" })} />
          <Color label="Buttons" value={theme.button} onChange={(v) => setTheme({ button: v, preset: "Custom" })} />
          <Color label="Background" value={theme.background} onChange={(v) => setTheme({ background: v, preset: "Custom" })} />
        </div>
        <Field label="Answer colours">
          <div className="flex flex-wrap items-center gap-2">
            {DEFAULT_ANSWERS.map((d, i) => {
              const cur = theme.answers?.[i] ?? d;
              return (
                <label key={i} className="relative grid h-10 w-10 cursor-pointer place-items-center rounded-xl border-2 border-ink font-bold" style={{ background: theme.answers?.length === 6 ? cur : `var(--a${i + 1})` }} title={`Answer ${i + 1}`}>
                  <span className="text-sm text-on-answer">{ANSWER_SHAPES[i]}</span>
                  <input type="color" value={cur} className="absolute inset-0 cursor-pointer opacity-0" onChange={(e) => { const next = [...(theme.answers?.length === 6 ? theme.answers : DEFAULT_ANSWERS)]; next[i] = e.target.value; setTheme({ answers: next, preset: "Custom" }); }} />
                </label>
              );
            })}
            {theme.answers?.length === 6 && <button onClick={() => setTheme({ answers: [] })} className="text-sm font-semibold underline">Reset</button>}
          </div>
        </Field>
        <Field label="Background style">
          <Pills value={theme.bgType} options={[["solid", "Solid"], ["gradient", "Gradient"], ["image", "Image"]]} onChange={(v) => setTheme({ bgType: v as Theme["bgType"] })} />
        </Field>
        {theme.bgType === "gradient" && <Color label="Gradient to" value={theme.background2} onChange={(v) => setTheme({ background2: v })} />}
        {theme.bgType === "image" && <Field label="Background image"><ImageUrlField value={theme.bgImage} onChange={(v) => setTheme({ bgImage: v })} canUpload={canUpload} label="background" /></Field>}
        <Field label="Your logo"><ImageUrlField value={theme.logo} onChange={(v) => setTheme({ logo: v })} canUpload={canUpload} label="logo" /></Field>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-bold text-muted-foreground">Preview</p>
        <div className="overflow-hidden rounded-3xl border-2 border-ink" style={themeStyle(theme)}>
          <div className="flex items-center gap-3 border-b-2 border-ink bg-card px-4 py-2">
            <Logo src={theme.logo || undefined} className="text-lg" />
            <span className="truncate text-sm font-bold">{title}</span>
          </div>
          <div className="flex flex-col gap-4 p-6">
            <p className="text-center font-display text-2xl font-extrabold">Which planet has the most moons?</p>
            <div className="grid grid-cols-2 gap-2">
              {["Earth", "Saturn", "Mars", "Venus"].map((o, i) => <div key={o} className={cn("chunky rounded-xl px-3 py-2 font-bold text-on-answer", ANSWER_COLORS[i])}>{ANSWER_SHAPES[i]} {o}</div>)}
            </div>
            <div className="flex justify-end gap-2">
              <span className="rounded-full bg-accent px-3 py-1 text-sm font-bold text-accent-foreground">Accent</span>
              <button className="chunky rounded-full bg-btn px-5 py-2 font-display font-bold text-btn-foreground">Next ▶</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SessionPanel({ settings, setSettings, canUpload }: { settings: SessionSettings; setSettings: (p: Partial<SessionSettings>) => void; canUpload: boolean }) {
  return (
    <section className="card-ink flex flex-col gap-5 rounded-3xl p-6">
      <h2 className="font-display text-2xl font-extrabold">Session defaults</h2>
      <p className="-mt-3 text-sm text-muted-foreground">Each slide can override these. You can also flip live results while hosting.</p>
      <Toggle label="Show live results on the big screen while answers come in" checked={settings.liveResults} onChange={(v) => setSettings({ liveResults: v })} />
      <Toggle label="Show results on players' phones after each question" checked={settings.playerResults} onChange={(v) => setSettings({ playerResults: v })} />
      <Toggle label="Show the leaderboard after scored questions" checked={settings.leaderboard} onChange={(v) => setSettings({ leaderboard: v })} />
      <Toggle label="Allow live emoji reactions from players" checked={settings.reactions} onChange={(v) => setSettings({ reactions: v })} />
      <hr className="border-ink/20" />
      <h3 className="font-display text-xl font-extrabold">End slide</h3>
      <Pills value={settings.endScreen} options={[["podium", "🏆 Podium"], ["leaderboard", "📋 Leaderboard"], ["message", "✉️ Custom message"], ["none", "Nothing"]]} onChange={(v) => setSettings({ endScreen: v as SessionSettings["endScreen"] })} />
      {settings.endScreen !== "none" && (
        <input value={settings.endTitle} maxLength={120} onChange={(e) => setSettings({ endTitle: e.target.value })} placeholder="Title" className="rounded-xl border-2 border-ink bg-background px-4 py-2 font-display text-lg font-bold outline-none" />
      )}
      {settings.endScreen === "message" && (
        <>
          <textarea value={settings.endMessage} maxLength={1000} rows={3} onChange={(e) => setSettings({ endMessage: e.target.value })} placeholder="Thanks for playing! Grab a coffee…" className="rounded-xl border-2 border-ink bg-background px-4 py-2 outline-none" />
          <Field label="Image (optional)"><ImageUrlField value={settings.endImage} onChange={(v) => setSettings({ endImage: v })} canUpload={canUpload} label="end image" /></Field>
        </>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-sm font-bold">{label}</p>
      {children}
    </div>
  );
}

function Pills({ value, options, onChange }: { value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([v, l]) => (
        <button key={v} onClick={() => onChange(v)} className={cn("rounded-full border-2 border-ink px-3 py-1 text-sm font-bold", value === v ? "bg-primary text-primary-foreground" : "bg-card hover:bg-secondary")}>{l}</button>
      ))}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border-2 border-ink bg-background px-4 py-3 font-semibold">
      {label}
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

function Color({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-3 rounded-2xl border-2 border-ink bg-background px-3 py-2 text-sm font-bold">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent" />
      <span className="flex-1">{label}</span>
      <span className="font-mono text-xs text-muted-foreground">{value}</span>
    </label>
  );
}

function IconBtn({ children, label, onClick }: { children: ReactNode; label: string; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button aria-label={label} title={label} onClick={onClick} className="grid h-7 w-7 place-items-center rounded-lg border border-ink/30 bg-card hover:bg-secondary">
      {children}
    </button>
  );
}

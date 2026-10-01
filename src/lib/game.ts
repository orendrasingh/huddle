export type ActivityType = "content" | "quiz" | "truefalse" | "typeanswer" | "poll" | "cloud" | "scale" | "open" | "order";

export interface Option {
  text: string;
  image?: string | undefined;
}

export interface Media {
  kind: "image" | "video" | "youtube";
  url: string;
}

export interface SlideOverrides {
  liveResults?: boolean | undefined;
  playerResults?: boolean | undefined;
  leaderboard?: boolean | undefined;
}

export interface Question {
  id: string;
  type: ActivityType;
  prompt: string;
  body?: string | undefined;
  media?: Media | null | undefined;
  layout?: "center" | "left" | "right" | "full" | undefined;
  options: Option[];
  correct: number;
  accepted?: string[] | undefined;
  scaleMax?: number | undefined;
  scaleLabels?: [string, string] | undefined;
  wall?: boolean | undefined;
  timeLimit: number | null;
  overrides?: SlideOverrides | undefined;
}

export interface SessionSettings {
  liveResults: boolean;
  playerResults: boolean;
  leaderboard: boolean;
  reactions: boolean;
  endScreen: "podium" | "leaderboard" | "message" | "none";
  endTitle: string;
  endMessage: string;
  endImage: string;
}

export interface Theme {
  preset: string;
  primary: string;
  accent: string;
  background: string;
  button: string;
  bgType: "solid" | "gradient" | "image";
  background2: string;
  bgImage: string;
  logo: string;
  /** Custom colours for answer tiles 1–6 (empty = defaults). */
  answers?: string[] | undefined;
}

export type Phase = "lobby" | "question" | "reveal" | "leaderboard" | "ended";

export interface Room {
  id: string;
  pin: string;
  title: string;
  questions: Question[];
  current_index: number;
  phase: Phase;
  question_started_at: string | null;
  theme: Partial<Theme>;
  settings: Partial<SessionSettings>;
}

export interface Player {
  id: string;
  room_id: string;
  nickname: string;
  avatar: string;
  score: number;
  streak: number;
}

export interface Response {
  id: string;
  player_id: string;
  question_index: number;
  answer: string;
  is_correct: boolean | null;
  points: number;
}

export const TYPE_META: Record<ActivityType, { label: string; emoji: string; blurb: string }> = {
  content: { label: "Slide", emoji: "🖼️", blurb: "Present text, images or video" },
  quiz: { label: "Trivia", emoji: "⚡", blurb: "Timed multiple choice with points & streaks" },
  truefalse: { label: "True / False", emoji: "✅", blurb: "Quick two-way calls" },
  typeanswer: { label: "Type answer", emoji: "⌨️", blurb: "Players type the right answer" },
  order: { label: "Puzzle", emoji: "🧩", blurb: "Put items in the right order" },
  poll: { label: "Poll", emoji: "📊", blurb: "Everyone votes, watch the bars move" },
  cloud: { label: "Word cloud", emoji: "☁️", blurb: "Short answers that grow as they repeat" },
  scale: { label: "Scale", emoji: "🎚️", blurb: "Rate from 1 to 5 or 10" },
  open: { label: "Open-ended", emoji: "💬", blurb: "Short answers on a live wall" },
};

export const SCORED: ActivityType[] = ["quiz", "truefalse", "typeanswer", "order"];
export const isScored = (t: ActivityType) => SCORED.includes(t);
export const hasOptions = (t: ActivityType) => ["quiz", "truefalse", "poll", "order"].includes(t);

export const DEFAULT_SETTINGS: SessionSettings = {
  liveResults: true,
  playerResults: true,
  leaderboard: true,
  reactions: true,
  endScreen: "podium",
  endTitle: "That's a wrap! 🎉",
  endMessage: "",
  endImage: "",
};

export function settingsOf(s: Partial<SessionSettings> | undefined | null): SessionSettings {
  return { ...DEFAULT_SETTINGS, ...(s ?? {}) };
}

export function slideFlag(q: Question, s: SessionSettings, key: keyof SlideOverrides): boolean {
  const o = q.overrides?.[key];
  return typeof o === "boolean" ? o : s[key];
}

export const ANSWER_COLORS = ["bg-a1", "bg-a2", "bg-a3", "bg-a4", "bg-a5", "bg-a6"];
export const ANSWER_SHAPES = ["▲", "◆", "●", "■", "★", "✚"];
export const AVATARS = ["🦊", "🐸", "🐙", "🦄", "🐼", "🐯", "🦉", "🐝", "🐳", "🌵", "🍩", "🚀", "🎸", "🌈", "🍉", "👾"];
export const REACTIONS = ["❤️", "😂", "👏", "😮", "🔥"];

export const uid = () => Math.random().toString(36).slice(2, 10);

/** Old rooms stored options as plain strings. */
export function optText(o: Option | string | undefined): string {
  if (!o) return "";
  return typeof o === "string" ? o : o.text;
}
export function optImage(o: Option | string | undefined): string | undefined {
  return o && typeof o !== "string" ? o.image : undefined;
}

const DEFAULT_TIME: Record<ActivityType, number | null> = {
  content: null, quiz: 20, truefalse: 15, typeanswer: 30, order: 40, poll: 30, cloud: 45, scale: 30, open: 60,
};

export function optionsFor(type: ActivityType, prev: Option[] = []): Option[] {
  if (type === "truefalse") return [{ text: "True" }, { text: "False" }];
  if (!hasOptions(type)) return [];
  const filled = prev.length >= 2 ? prev : [{ text: "" }, { text: "" }, { text: "" }, { text: "" }];
  return type === "order" ? filled.slice(0, 6) : filled;
}

export function newQuestion(type: ActivityType = "quiz"): Question {
  return {
    id: uid(),
    type,
    prompt: "",
    options: optionsFor(type),
    correct: 0,
    accepted: type === "typeanswer" ? [""] : undefined,
    scaleMax: type === "scale" ? 5 : undefined,
    scaleLabels: type === "scale" ? ["Not at all", "Totally"] : undefined,
    layout: type === "content" ? "center" : undefined,
    timeLimit: DEFAULT_TIME[type],
  };
}

export function convertQuestion(q: Question, type: ActivityType): Question {
  const base = newQuestion(type);
  return {
    ...base,
    id: q.id,
    prompt: q.prompt,
    body: q.body,
    media: q.media,
    overrides: q.overrides,
    options: optionsFor(type, q.options),
    correct: type === "truefalse" ? Math.min(q.correct, 1) : q.correct,
  };
}

export function sampleActivity(): { title: string; questions: Question[] } {
  const o = (...t: string[]) => t.map((text) => ({ text }));
  return {
    title: "Friday Hangout",
    questions: [
      { id: uid(), type: "content", prompt: "Welcome to Friday Hangout 👋", body: "Grab your phone, join with the PIN and let's warm up.", layout: "center", options: [], correct: 0, timeLimit: null },
      { id: uid(), type: "cloud", prompt: "One word to describe your week?", options: [], correct: 0, timeLimit: 45 },
      { id: uid(), type: "quiz", prompt: "Which planet has the most moons?", options: o("Earth", "Saturn", "Mars", "Venus"), correct: 1, timeLimit: 20 },
      { id: uid(), type: "poll", prompt: "Best snack for a long meeting?", options: o("Popcorn", "Fruit", "Chocolate", "Chips"), correct: 0, timeLimit: 30 },
      { id: uid(), type: "truefalse", prompt: "An octopus has three hearts.", options: o("True", "False"), correct: 0, timeLimit: 15 },
      { id: uid(), type: "scale", prompt: "How energised do you feel right now?", options: [], correct: 0, scaleMax: 5, scaleLabels: ["Sleepy", "Buzzing"], timeLimit: 30 },
    ],
  };
}

export function remainingSeconds(room: Room, now: number): number | null {
  const q = room.questions[room.current_index];
  if (!q || !room.question_started_at) return 0;
  if (q.timeLimit == null) return null;
  const elapsed = (now - new Date(room.question_started_at).getTime()) / 1000;
  return Math.max(0, Math.ceil(q.timeLimit - elapsed));
}

export function answerLimit(t: ActivityType) {
  return t === "cloud" ? 3 : 1;
}

/** Deterministic shuffle of order-puzzle items for display to players. */
export function shuffledOrder(n: number, seed: string): number[] {
  const idx = Array.from({ length: n }, (_, i) => i);
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  for (let i = n - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) >>> 0;
    const j = h % (i + 1);
    [idx[i], idx[j]] = [idx[j]!, idx[i]!];
  }
  if (n > 1 && idx.every((v, i) => v === i)) idx.reverse();
  return idx;
}

export function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
  return m ? m[1]! : null;
}

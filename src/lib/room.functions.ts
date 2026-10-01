import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const url = z.string().max(2000);
const optionSchema = z.object({ text: z.string().trim().max(120), image: url.optional() });
const questionSchema = z.object({
  id: z.string().max(40),
  type: z.enum(["content", "quiz", "truefalse", "typeanswer", "poll", "cloud", "scale", "open", "order"]),
  prompt: z.string().trim().max(300),
  body: z.string().max(2000).optional(),
  media: z.object({ kind: z.enum(["image", "video", "youtube"]), url }).nullable().optional(),
  layout: z.enum(["center", "left", "right", "full"]).optional(),
  options: z.array(optionSchema).max(6),
  correct: z.number().int().min(0).max(5),
  accepted: z.array(z.string().trim().max(80)).max(10).optional(),
  scaleMax: z.number().int().min(3).max(10).optional(),
  scaleLabels: z.tuple([z.string().max(40), z.string().max(40)]).optional(),
  wall: z.boolean().optional(),
  timeLimit: z.number().int().min(5).max(300).nullable(),
  overrides: z
    .object({ liveResults: z.boolean().optional(), playerResults: z.boolean().optional(), leaderboard: z.boolean().optional() })
    .optional(),
});
const themeSchema = z.record(z.string(), z.union([z.string().max(2000), z.array(z.string().max(40)).max(6)]));
const settingsSchema = z
  .object({
    liveResults: z.boolean(),
    playerResults: z.boolean(),
    leaderboard: z.boolean(),
    reactions: z.boolean(),
    endScreen: z.enum(["podium", "leaderboard", "message", "none"]),
    endTitle: z.string().max(120),
    endMessage: z.string().max(1000),
    endImage: url,
  })
  .partial();

const roomInput = z.object({
  title: z.string().trim().min(1).max(80),
  questions: z.array(questionSchema).min(1).max(80),
  theme: themeSchema.optional(),
  settings: settingsSchema.optional(),
  quizId: z.string().uuid().optional(),
});
type RoomInput = z.infer<typeof roomInput>;

function token() {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

const KEYED = ["quiz", "truefalse", "typeanswer"];
/** Players can read the room row, so answer keys stay private until reveal. */
const stripKeys = (qs: RoomInput["questions"]) =>
  qs.map((q) => (KEYED.includes(q.type) ? { ...q, correct: -1, accepted: [] } : q));

async function insertRoom(data: RoomInput, ownerId: string | null) {
  const db = await admin();
  for (let attempt = 0; attempt < 5; attempt++) {
    const pin = String(Math.floor(100000 + Math.random() * 900000));
    const { data: room, error } = await db
      .from("rooms")
      .insert({
        pin,
        title: data.title,
        questions: stripKeys(data.questions),
        theme: data.theme ?? {},
        settings: data.settings ?? {},
        owner_id: ownerId,
        quiz_id: ownerId ? (data.quizId ?? null) : null,
      })
      .select("id, pin")
      .single();
    if (error) continue;
    const hostToken = token();
    await db.from("room_secrets").insert({ room_id: room.id, host_token: hostToken, questions: data.questions });
    return { roomId: room.id, pin: room.pin, hostToken };
  }
  throw new Error("Could not create room");
}

export const createRoom = createServerFn({ method: "POST" })
  .inputValidator((d) => roomInput.parse(d))
  .handler(async ({ data }) => insertRoom(data, null));

export const createOwnedRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => roomInput.parse(d))
  .handler(async ({ data, context }) => insertRoom(data, context.userId));

export const hostControl = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        roomId: z.string().uuid(),
        hostToken: z.string().min(10).max(100),
        action: z.enum(["next", "reveal", "leaderboard", "end", "settings"]),
        settings: settingsSchema.optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: secret } = await db.from("room_secrets").select("host_token, questions").eq("room_id", data.roomId).single();
    if (!secret || secret.host_token !== data.hostToken) throw new Error("Not the host");
    const { data: room } = await db.from("rooms").select("*").eq("id", data.roomId).single();
    if (!room) throw new Error("Room not found");
    const questions = room.questions as { type: string }[];

    if (data.action === "settings") {
      const merged = { ...((room.settings as object) ?? {}), ...(data.settings ?? {}) };
      await db.from("rooms").update({ settings: merged }).eq("id", room.id);
    } else if (data.action === "next") {
      const idx = room.current_index + 1;
      if (idx >= questions.length) {
        await db.from("rooms").update({ phase: "ended" }).eq("id", room.id);
      } else {
        await db
          .from("rooms")
          .update({ current_index: idx, phase: "question", question_started_at: new Date().toISOString() })
          .eq("id", room.id);
      }
    } else if (data.action === "reveal") {
      if (room.phase !== "question") return { ok: true };
      const full = ((secret.questions as Q[] | null) ?? (room.questions as Q[]));
      const key = full[room.current_index];
      const pub = [...(room.questions as Q[])];
      if (key && isGraded(key.type)) {
        await gradeQuestion(db, room, key);
        pub[room.current_index] = { ...pub[room.current_index]!, correct: key.correct, accepted: key.accepted ?? [] };
      }
      await db.from("rooms").update({ phase: "reveal", questions: pub as never }).eq("id", room.id);
    } else if (data.action === "leaderboard") {
      await db.from("rooms").update({ phase: "leaderboard" }).eq("id", room.id);
    } else {
      await db.from("rooms").update({ phase: "ended" }).eq("id", room.id);
    }
    return { ok: true };
  });

export const joinRoom = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        pin: z.string().regex(/^\d{6}$/),
        nickname: z.string().trim().min(1).max(20),
        avatar: z.string().min(1).max(8),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: room } = await db.from("rooms").select("id, phase").eq("pin", data.pin).maybeSingle();
    if (!room) return { error: "No room with that PIN" as const };
    if (room.phase === "ended") return { error: "That session has ended" as const };
    const { data: taken } = await db
      .from("players")
      .select("id")
      .eq("room_id", room.id)
      .ilike("nickname", data.nickname)
      .maybeSingle();
    if (taken) return { error: "Nickname taken — try another!" as const };
    const { data: player, error } = await db
      .from("players")
      .insert({ room_id: room.id, nickname: data.nickname, avatar: data.avatar })
      .select("id")
      .single();
    if (error || !player) return { error: "Could not join" as const };
    const t = token();
    await db.from("player_secrets").insert({ player_id: player.id, token: t });
    return { roomId: room.id, playerId: player.id, token: t };
  });

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N} ]/gu, "").replace(/\s+/g, " ").trim();

type Q = {
  type: string;
  options: unknown[];
  correct: number;
  timeLimit: number | null;
  accepted?: string[];
  scaleMax?: number;
};

export const submitAnswer = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        playerId: z.string().uuid(),
        token: z.string().min(10).max(100),
        answer: z.string().trim().min(1).max(100),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: secret } = await db.from("player_secrets").select("token").eq("player_id", data.playerId).single();
    if (!secret || secret.token !== data.token) return { error: "Not allowed" };
    const { data: player } = await db.from("players").select("id, room_id").eq("id", data.playerId).single();
    if (!player) return { error: "Player not found" };
    const { data: room } = await db.from("rooms").select("*").eq("id", player.room_id).single();
    if (!room || room.phase !== "question") return { error: "Too late!" };
    const q = (room.questions as Q[])[room.current_index];
    if (!q || q.type === "content") return { error: "No active question" };
    const elapsed = (Date.now() - new Date(room.question_started_at!).getTime()) / 1000;
    if (q.timeLimit != null && elapsed > q.timeLimit + 2) return { error: "Time's up!" };

    const { data: existing } = await db
      .from("responses")
      .select("id")
      .eq("player_id", player.id)
      .eq("question_index", room.current_index);
    const limit = q.type === "cloud" ? 3 : 1;
    if ((existing?.length ?? 0) >= limit) return { error: "Already answered" };

    let answer = data.answer;
    const n = q.options.length;

    if (q.type === "cloud") {
      answer = answer.toLowerCase().replace(/\s+/g, " ").slice(0, 24);
    } else if (q.type === "open") {
      answer = answer.replace(/\s+/g, " ").slice(0, 80);
    } else if (q.type === "scale") {
      const v = Number(answer);
      if (!Number.isInteger(v) || v < 1 || v > (q.scaleMax ?? 5)) return { error: "Invalid rating" };
    } else if (q.type === "typeanswer") {
      answer = answer.slice(0, 60);
    } else if (q.type === "order") {
      const parts = answer.split(",").map(Number);
      if (parts.length !== n || new Set(parts).size !== n || parts.some((p) => !Number.isInteger(p) || p < 0 || p >= n))
        return { error: "Invalid order" };
    } else {
      const idx = Number(answer);
      if (!Number.isInteger(idx) || idx < 0 || idx >= n) return { error: "Invalid option" };
    }

    await db.from("responses").insert({
      room_id: room.id,
      player_id: player.id,
      question_index: room.current_index,
      answer,
      is_correct: null,
      points: 0,
    });
    return { ok: true };
  });

const isGraded = (t: string) => ["quiz", "truefalse", "typeanswer", "order"].includes(t);

function isRight(q: Q, answer: string) {
  if (q.type === "typeanswer") return (q.accepted ?? []).some((a) => a && norm(a) === norm(answer));
  if (q.type === "order") return answer.split(",").map(Number).every((p, i) => p === i);
  return Number(answer) === q.correct;
}

type Db = Awaited<ReturnType<typeof admin>>;
/** Scores every answer for the current slide at reveal, in two batched writes. */
async function gradeQuestion(db: Db, room: { id: string; current_index: number; question_started_at: string | null }, q: Q) {
  const [{ data: rs }, { data: ps }] = await Promise.all([
    db.from("responses").select("*").eq("room_id", room.id).eq("question_index", room.current_index),
    db.from("players").select("*").eq("room_id", room.id),
  ]);
  const started = new Date(room.question_started_at ?? Date.now()).getTime();
  const ref = q.timeLimit ?? 30;
  const byPlayer = new Map((rs ?? []).map((r) => [r.player_id, r]));
  const respRows = [];
  const playerRows = [];
  for (const p of ps ?? []) {
    const r = byPlayer.get(p.id);
    const ok = r ? isRight(q, r.answer) : false;
    let points = 0;
    const streak = ok ? p.streak + 1 : 0;
    if (r && ok) {
      const elapsed = (new Date(r.created_at).getTime() - started) / 1000;
      points = Math.round(500 + 500 * Math.max(0, 1 - elapsed / ref)) + Math.min(streak - 1, 5) * 100;
    }
    if (r) respRows.push({ ...r, is_correct: ok, points });
    if (points || streak !== p.streak) playerRows.push({ ...p, score: p.score + points, streak });
  }
  if (respRows.length) await db.from("responses").upsert(respRows);
  if (playerRows.length) await db.from("players").upsert(playerRows);
}

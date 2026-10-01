import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Player, Response, Room } from "./game";

export function useRoomLive(roomId: string) {
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [responses, setResponses] = useState<Response[]>([]);
  const [loaded, setLoaded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [r, p, a] = await Promise.all([
        supabase.from("rooms").select("*").eq("id", roomId).maybeSingle(),
        supabase.from("players").select("*").eq("room_id", roomId).order("created_at"),
        supabase.from("responses").select("*").eq("room_id", roomId),
      ]);
      if (!alive) return;
      setRoom(r.data ? ({ ...r.data, questions: (r.data as { questions?: unknown }).questions ?? [] } as unknown as Room) : null);
      setPlayers((p.data as Player[]) ?? []);
      setResponses((a.data as Response[]) ?? []);
      setLoaded(true);
    };
    const schedule = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(load, 120);
    };
    load();
    const ch = supabase
      .channel(`room-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` }, (payload) => {
        if (payload.new && "id" in payload.new) {
          // Realtime omits large unchanged columns (e.g. questions/theme jsonb) — merge, don't replace.
          const next = Object.fromEntries(
            Object.entries(payload.new as Record<string, unknown>).filter(([, v]) => v !== undefined),
          );
          setRoom((prev) => ({ ...(prev ?? {}), ...next }) as unknown as Room);
        }
      })
      // apply row changes in place — refetching everything per answer doesn't scale to big crowds
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `room_id=eq.${roomId}` }, (pl) => {
        if (pl.eventType === "DELETE") return schedule();
        const row = pl.new as Player;
        setPlayers((prev) => {
          const i = prev.findIndex((x) => x.id === row.id);
          if (i === -1) return [...prev, row];
          const next = prev.slice();
          next[i] = row;
          return next;
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "responses", filter: `room_id=eq.${roomId}` }, (pl) => {
        if (pl.eventType === "DELETE") return schedule();
        const row = pl.new as Response;
        setResponses((prev) => {
          const i = prev.findIndex((x) => x.id === row.id);
          if (i === -1) return [...prev, row];
          const next = prev.slice();
          next[i] = row;
          return next;
        });
      })
      .subscribe();
    return () => {
      alive = false;
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(ch);
    };
  }, [roomId]);

  return { room, players, responses, loaded };
}

export function useNow(interval = 250) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(t);
  }, [interval]);
  return now;
}

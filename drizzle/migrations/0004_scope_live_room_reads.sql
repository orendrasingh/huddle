CREATE OR REPLACE FUNCTION public.room_is_visible(_room_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rooms r
    WHERE r.id = _room_id
      AND (r.created_at > now() - interval '12 hours'
           OR (auth.uid() IS NOT NULL AND r.owner_id = auth.uid()))
  )
$$;
REVOKE EXECUTE ON FUNCTION public.room_is_visible(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.room_is_visible(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "rooms readable" ON public.rooms;
CREATE POLICY "live or own rooms readable" ON public.rooms
  FOR SELECT TO anon, authenticated
  USING (created_at > now() - interval '12 hours' OR (auth.uid() IS NOT NULL AND owner_id = auth.uid()));

DROP POLICY IF EXISTS "players readable" ON public.players;
CREATE POLICY "players of visible rooms readable" ON public.players
  FOR SELECT TO anon, authenticated
  USING (public.room_is_visible(room_id));

DROP POLICY IF EXISTS "responses readable" ON public.responses;
CREATE POLICY "responses of visible rooms readable" ON public.responses
  FOR SELECT TO anon, authenticated
  USING (public.room_is_visible(room_id));

CREATE INDEX IF NOT EXISTS rooms_created_at_idx ON public.rooms (created_at);
CREATE INDEX IF NOT EXISTS rooms_owner_id_idx ON public.rooms (owner_id);
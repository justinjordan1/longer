-- fix: letters UPDATE policy was rejecting recipient soft-deletes.
-- recreate it explicitly scoped to authenticated, using the (select auth.uid()) form
-- recommended by supabase. also re-grant update to be safe.

drop policy if exists "letters_update_participant" on public.letters;
create policy "letters_update_participant"
  on public.letters for update
  to authenticated
  using (
    (select auth.uid()) = sender_id
    or
    (select auth.uid()) = recipient_id
  )
  with check (
    (select auth.uid()) = sender_id
    or
    (select auth.uid()) = recipient_id
  );

grant update on public.letters to authenticated;

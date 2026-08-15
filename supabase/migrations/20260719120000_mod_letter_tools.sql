-- Mod tooling for letter reports.
--
-- Fixes: letters RLS ("letters_select_participant") only lets the sender or
-- recipient read a letter, so the mod console's LETTER REPORTS panel could
-- count open reports but never load the letters themselves. Route mod reads
-- and report dismissal through SECURITY DEFINER functions (same pattern as
-- soft_delete_letter / mark_letter_read); mod status is enforced inside.

create or replace function public.mod_reported_letters()
returns table (
  id uuid,
  title text,
  body text,
  created_at timestamptz,
  sender_handle text,
  recipient_handle text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_mod
  ) then
    raise exception 'not a moderator' using errcode = 'P0001';
  end if;

  return query
    select l.id, l.title, l.body, l.created_at,
           s.handle as sender_handle,
           r.handle as recipient_handle
      from public.letters l
      join public.profiles s on s.id = l.sender_id
      join public.profiles r on r.id = l.recipient_id
      where exists (
        select 1 from public.letter_reports lr
        where lr.letter_id = l.id and lr.dismissed_at is null
      )
      order by l.created_at desc;
end;
$$;

revoke all on function public.mod_reported_letters() from public;
grant execute on function public.mod_reported_letters() to authenticated;

create or replace function public.mod_dismiss_letter_reports(p_letter_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_mod
  ) then
    raise exception 'not a moderator' using errcode = 'P0001';
  end if;

  update public.letter_reports
    set dismissed_at = now()
    where letter_id = p_letter_id
      and dismissed_at is null;
end;
$$;

revoke all on function public.mod_dismiss_letter_reports(uuid) from public;
grant execute on function public.mod_dismiss_letter_reports(uuid) to authenticated;

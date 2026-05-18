-- Route letter participant-side UPDATEs through SECURITY DEFINER functions
-- so they're not subject to table RLS. Auth is enforced inside the function.

create or replace function public.soft_delete_letter(p_letter_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_row  record;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = 'P0001';
  end if;

  select sender_id, recipient_id
    into v_row
    from public.letters
    where id = p_letter_id;

  if not found then
    raise exception 'letter not found' using errcode = 'P0001';
  end if;

  if v_user = v_row.recipient_id then
    update public.letters
      set recipient_deleted_at = now()
      where id = p_letter_id;
  elsif v_user = v_row.sender_id then
    update public.letters
      set sender_deleted_at = now()
      where id = p_letter_id;
  else
    raise exception 'not your letter' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.soft_delete_letter(uuid) from public;
grant execute on function public.soft_delete_letter(uuid) to authenticated;

create or replace function public.mark_letter_read(p_letter_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = 'P0001';
  end if;

  update public.letters
    set read_at = now()
    where id = p_letter_id
      and recipient_id = v_user
      and read_at is null;
end;
$$;

revoke all on function public.mark_letter_read(uuid) from public;
grant execute on function public.mark_letter_read(uuid) to authenticated;

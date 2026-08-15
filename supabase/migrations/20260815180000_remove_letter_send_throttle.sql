-- Letters are no longer capped at 3 per 24h to the same recipient.
--
-- The trigger stays: it still enforces the block list, which is the part that
-- protects recipients. Only the rate cap is dropped, so letters_enforce_send
-- is recreated without it rather than the trigger being removed.

create or replace function public.letters_enforce_send()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_blocked boolean;
begin
  select exists (
    select 1 from public.letter_blocks
    where blocker_id = new.recipient_id
      and blocked_id = new.sender_id
  ) into is_blocked;

  if is_blocked then
    raise exception 'letter_blocked' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

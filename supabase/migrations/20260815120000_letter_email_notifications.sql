-- email notifications for letters: per-profile opt-out.
-- default on, so existing users keep getting told when mail arrives.

alter table public.profiles
  add column if not exists letter_email_notifications boolean not null default true;

-- the preference is nobody's business but the owner's: it is deliberately
-- absent from the column grants handed to anon in 20260504152000.
grant select (letter_email_notifications) on public.profiles to authenticated;
grant update (letter_email_notifications) on public.profiles to authenticated;

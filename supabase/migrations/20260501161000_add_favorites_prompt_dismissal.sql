alter table public.profiles
  add column if not exists dismissed_favorites_prompt boolean not null default false;

create or replace function public.dismiss_favorites_prompt()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
  set dismissed_favorites_prompt = true
  where id = auth.uid();
$$;

revoke all on function public.dismiss_favorites_prompt() from public;
grant execute on function public.dismiss_favorites_prompt() to authenticated;

alter table public.profile_favorites
  drop constraint if exists profile_favorites_kind_check;

alter table public.profile_favorites
  add constraint profile_favorites_kind_check
  check (kind in ('book', 'movie', 'album'));

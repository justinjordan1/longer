alter table public.profiles
  drop constraint if exists profiles_access_method_check;

alter table public.profiles
  add constraint profiles_access_method_check
  check (access_method in ('gatech', 'beta', 'google'));

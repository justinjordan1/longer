alter table public.posts
  add column if not exists post_visibility text not null default 'feed';

alter table public.posts
  drop constraint if exists posts_post_visibility_check;

alter table public.posts
  add constraint posts_post_visibility_check
  check (post_visibility in ('feed', 'profile'));

alter table public.posts
  add column if not exists profile_pin_position integer;

alter table public.posts
  drop constraint if exists posts_profile_pin_position_check;

alter table public.posts
  add constraint posts_profile_pin_position_check
  check (profile_pin_position is null or profile_pin_position between 1 and 3);

create unique index if not exists posts_author_profile_pin_position_uidx
  on public.posts(author_id, profile_pin_position)
  where profile_pin_position is not null and is_removed = false;

alter table public.post_drafts
  add column if not exists post_visibility text not null default 'feed';

alter table public.post_drafts
  drop constraint if exists post_drafts_post_visibility_check;

alter table public.post_drafts
  add constraint post_drafts_post_visibility_check
  check (post_visibility in ('feed', 'profile'));

create or replace function public.set_profile_post_pin(
  p_post_id uuid,
  p_position integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author_id uuid;
begin
  if p_position is not null and (p_position < 1 or p_position > 3) then
    raise exception 'pin position must be between 1 and 3';
  end if;

  select author_id
    into v_author_id
    from public.posts
   where id = p_post_id
     and author_id = auth.uid()
     and is_removed = false;

  if v_author_id is null then
    raise exception 'post not found or not yours';
  end if;

  if p_position is null then
    update public.posts
       set profile_pin_position = null
     where id = p_post_id
       and author_id = auth.uid();
    return;
  end if;

  update public.posts
     set profile_pin_position = null
   where author_id = auth.uid()
     and profile_pin_position = p_position;

  update public.posts
     set profile_pin_position = p_position
   where id = p_post_id
     and author_id = auth.uid();
end;
$$;

grant execute on function public.set_profile_post_pin(uuid, integer) to authenticated;

grant usage on schema public to anon, authenticated;

grant select (
  id,
  author_id,
  title,
  body,
  word_count,
  created_at,
  publish_at,
  is_removed,
  editorial_flag,
  search_tsv,
  post_visibility,
  profile_pin_position
) on public.posts to anon;

grant select (
  id,
  post_id,
  author_id,
  body,
  word_count,
  created_at,
  is_removed,
  parent_comment_id
) on public.comments to anon;

grant select (
  id,
  handle,
  affiliation,
  is_mod,
  created_at
) on public.profiles to anon;

grant select (
  user_id,
  kind,
  position,
  external_id,
  title,
  subtitle,
  cover_url,
  created_at
) on public.profile_favorites to anon;

grant select on public.posts to authenticated;
grant select on public.comments to authenticated;
grant select on public.profiles to authenticated;
grant select on public.profile_favorites to authenticated;

do $$
begin
  if to_regclass('public.post_metrics') is not null then
    execute 'grant select on public.post_metrics to anon, authenticated';
  end if;
end;
$$;

drop policy if exists "posts_public_read_published" on public.posts;
create policy "posts_public_read_published"
on public.posts
for select
to anon, authenticated
using (publish_at <= now());

drop policy if exists "comments_public_read_for_published_posts" on public.comments;
create policy "comments_public_read_for_published_posts"
on public.comments
for select
to anon, authenticated
using (
  is_removed = false
  and exists (
    select 1
    from public.posts
    where posts.id = comments.post_id
      and posts.publish_at <= now()
  )
);

drop policy if exists "profiles_public_read" on public.profiles;
create policy "profiles_public_read"
on public.profiles
for select
to anon, authenticated
using (true);

drop policy if exists "profile_favorites_public_read" on public.profile_favorites;
create policy "profile_favorites_public_read"
on public.profile_favorites
for select
to anon, authenticated
using (true);

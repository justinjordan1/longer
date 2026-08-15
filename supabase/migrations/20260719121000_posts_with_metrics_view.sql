-- Codify the posts_with_metrics view in migrations.
--
-- The view already exists in the database (the mod console reads it) but was
-- never tracked here. This recreates it with an explicit definition and adds
-- word_count / post_visibility / last_comment_at so the front page can use it
-- instead of fetching every vote and comment and aggregating in JS.
--
-- security_invoker: metric subqueries respect the caller's RLS, so counts
-- match what the caller could compute themselves (votes and non-removed
-- comments on published posts are publicly readable).

drop view if exists public.posts_with_metrics;

create view public.posts_with_metrics
with (security_invoker = true)
as
select
  p.id,
  p.author_id,
  p.title,
  p.publish_at,
  p.created_at,
  p.word_count,
  p.is_removed,
  p.editorial_flag,
  p.post_visibility,
  coalesce(v.up_count, 0)::int   as up_count,
  coalesce(v.down_count, 0)::int as down_count,
  coalesce(c.comment_count, 0)::int as comment_count,
  c.last_comment_at
from public.posts p
left join lateral (
  select
    count(*) filter (where direction = 'up')   as up_count,
    count(*) filter (where direction = 'down') as down_count
  from public.votes
  where votes.post_id = p.id
) v on true
left join lateral (
  select
    count(*)        as comment_count,
    max(created_at) as last_comment_at
  from public.comments
  where comments.post_id = p.id
    and comments.is_removed = false
) c on true;

grant select on public.posts_with_metrics to anon, authenticated;

grant select (
  post_id,
  direction
) on public.votes to anon;

grant select on public.votes to authenticated;

drop policy if exists "votes_public_read_for_published_posts" on public.votes;
create policy "votes_public_read_for_published_posts"
on public.votes
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.posts
    where posts.id = votes.post_id
      and posts.publish_at <= now()
  )
);

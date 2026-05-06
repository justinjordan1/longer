create table if not exists public.post_drafts (
  id uuid not null default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default '' check (char_length(title) <= 200),
  body text not null default '',
  word_count integer not null default 0 check (word_count >= 0),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint post_drafts_pkey primary key (id)
);

alter table public.post_drafts enable row level security;

drop policy if exists "post_drafts_select_own" on public.post_drafts;
create policy "post_drafts_select_own"
  on public.post_drafts for select
  using (auth.uid() = author_id);

drop policy if exists "post_drafts_insert_own" on public.post_drafts;
create policy "post_drafts_insert_own"
  on public.post_drafts for insert
  with check (auth.uid() = author_id);

drop policy if exists "post_drafts_update_own" on public.post_drafts;
create policy "post_drafts_update_own"
  on public.post_drafts for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

drop policy if exists "post_drafts_delete_own" on public.post_drafts;
create policy "post_drafts_delete_own"
  on public.post_drafts for delete
  using (auth.uid() = author_id);

create index if not exists post_drafts_author_updated_idx
  on public.post_drafts(author_id, updated_at desc);

grant select, insert, update, delete on public.post_drafts to authenticated;

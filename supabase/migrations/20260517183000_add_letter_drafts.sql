-- letter drafts: parallel to post_drafts, scoped to the author
create table if not exists public.letter_drafts (
  id uuid not null default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  recipient_handle text not null default '' check (char_length(recipient_handle) <= 64),
  title text not null default '' check (char_length(title) <= 200),
  body  text not null default '',
  word_count integer not null default 0 check (word_count >= 0),
  reply_to_letter_id uuid references public.letters(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint letter_drafts_pkey primary key (id)
);

alter table public.letter_drafts enable row level security;

drop policy if exists "letter_drafts_select_own" on public.letter_drafts;
create policy "letter_drafts_select_own"
  on public.letter_drafts for select
  using (auth.uid() = author_id);

drop policy if exists "letter_drafts_insert_own" on public.letter_drafts;
create policy "letter_drafts_insert_own"
  on public.letter_drafts for insert
  with check (auth.uid() = author_id);

drop policy if exists "letter_drafts_update_own" on public.letter_drafts;
create policy "letter_drafts_update_own"
  on public.letter_drafts for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

drop policy if exists "letter_drafts_delete_own" on public.letter_drafts;
create policy "letter_drafts_delete_own"
  on public.letter_drafts for delete
  using (auth.uid() = author_id);

create index if not exists letter_drafts_author_updated_idx
  on public.letter_drafts(author_id, updated_at desc);

grant select, insert, update, delete on public.letter_drafts to authenticated;

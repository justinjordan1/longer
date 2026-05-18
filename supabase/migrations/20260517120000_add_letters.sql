-- letters: private 1-to-1 messages between profiles ("mailroom")

create table if not exists public.letters (
  id uuid not null default gen_random_uuid(),
  sender_id    uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default '' check (char_length(title) <= 200),
  body  text not null default '',
  word_count integer not null default 0 check (word_count >= 0),
  created_at timestamp with time zone not null default now(),
  read_at    timestamp with time zone,
  sender_deleted_at    timestamp with time zone,
  recipient_deleted_at timestamp with time zone,
  constraint letters_pkey primary key (id),
  constraint letters_not_self check (sender_id <> recipient_id)
);

create index if not exists letters_recipient_created_idx
  on public.letters(recipient_id, created_at desc);
create index if not exists letters_sender_created_idx
  on public.letters(sender_id, created_at desc);
create index if not exists letters_recipient_unread_idx
  on public.letters(recipient_id) where read_at is null and recipient_deleted_at is null;

alter table public.letters enable row level security;

-- a participant can see a letter unless they've deleted it from their side
drop policy if exists "letters_select_participant" on public.letters;
create policy "letters_select_participant"
  on public.letters for select
  using (
    (auth.uid() = sender_id    and sender_deleted_at    is null)
    or
    (auth.uid() = recipient_id and recipient_deleted_at is null)
  );

-- sender writes their own letter
drop policy if exists "letters_insert_sender" on public.letters;
create policy "letters_insert_sender"
  on public.letters for insert
  with check (auth.uid() = sender_id);

-- recipient may mark read or soft-delete their side; sender may soft-delete their side
drop policy if exists "letters_update_participant" on public.letters;
create policy "letters_update_participant"
  on public.letters for update
  using (auth.uid() = sender_id or auth.uid() = recipient_id)
  with check (auth.uid() = sender_id or auth.uid() = recipient_id);

grant select, insert, update on public.letters to authenticated;

-- block list: recipient blocks a sender from sending more letters
create table if not exists public.letter_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamp with time zone not null default now(),
  constraint letter_blocks_pkey primary key (blocker_id, blocked_id),
  constraint letter_blocks_not_self check (blocker_id <> blocked_id)
);

alter table public.letter_blocks enable row level security;

drop policy if exists "letter_blocks_select_own" on public.letter_blocks;
create policy "letter_blocks_select_own"
  on public.letter_blocks for select
  using (auth.uid() = blocker_id);

drop policy if exists "letter_blocks_insert_own" on public.letter_blocks;
create policy "letter_blocks_insert_own"
  on public.letter_blocks for insert
  with check (auth.uid() = blocker_id);

drop policy if exists "letter_blocks_delete_own" on public.letter_blocks;
create policy "letter_blocks_delete_own"
  on public.letter_blocks for delete
  using (auth.uid() = blocker_id);

grant select, insert, delete on public.letter_blocks to authenticated;

-- enforce: cannot send if recipient has blocked you; cap 3 letters/24h per (sender, recipient)
create or replace function public.letters_enforce_send()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_count integer;
  is_blocked boolean;
begin
  select exists (
    select 1 from public.letter_blocks
    where blocker_id = new.recipient_id
      and blocked_id = new.sender_id
  ) into is_blocked;

  if is_blocked then
    raise exception 'letter_blocked' using errcode = 'P0001';
  end if;

  select count(*)
    from public.letters
    where sender_id = new.sender_id
      and recipient_id = new.recipient_id
      and created_at > now() - interval '24 hours'
    into recent_count;

  if recent_count >= 3 then
    raise exception 'letter_throttle' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists letters_enforce_send_trg on public.letters;
create trigger letters_enforce_send_trg
  before insert on public.letters
  for each row execute function public.letters_enforce_send();

-- reports for letters (kept separate from post reports to avoid widening that schema)
create table if not exists public.letter_reports (
  id uuid not null default gen_random_uuid(),
  letter_id uuid not null references public.letters(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('hateful', 'spam', 'other')),
  created_at timestamp with time zone not null default now(),
  dismissed_at timestamp with time zone,
  constraint letter_reports_pkey primary key (id),
  constraint letter_reports_unique unique (letter_id, reporter_id, kind)
);

alter table public.letter_reports enable row level security;

drop policy if exists "letter_reports_insert_own" on public.letter_reports;
create policy "letter_reports_insert_own"
  on public.letter_reports for insert
  with check (auth.uid() = reporter_id);

-- only mods read & manage reports
drop policy if exists "letter_reports_select_mod" on public.letter_reports;
create policy "letter_reports_select_mod"
  on public.letter_reports for select
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_mod
  ));

drop policy if exists "letter_reports_update_mod" on public.letter_reports;
create policy "letter_reports_update_mod"
  on public.letter_reports for update
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_mod
  ));

grant select, insert, update on public.letter_reports to authenticated;

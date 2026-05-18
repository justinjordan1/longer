import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import InboxList, { type LetterStub } from './InboxList'
import BlockList, { type BlockedStub } from './BlockList'
import LetterDraftsToggle, { type LetterDraftStub } from './LetterDraftsToggle'

type ProfileRel = { id: string; handle: string } | { id: string; handle: string }[] | null

type LetterRow = {
  id: string
  title: string
  body: string
  word_count: number
  created_at: string
  read_at: string | null
  sender_id: string
  recipient_id: string
  sender: ProfileRel
  recipient: ProfileRel
}

type BlockRow = {
  blocked_id: string
  created_at: string
  blocked: ProfileRel
}

function flattenProfile(p: ProfileRel) {
  if (Array.isArray(p)) return p[0] ?? null
  return p
}

export default async function MailroomPage({
  searchParams,
}: {
  searchParams: Promise<{ box?: string; sent?: string }>
}) {
  const params = await searchParams
  const box = params.box === 'sent' ? 'sent' : 'inbox'
  const justSent = params.sent === '1'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/mailroom')

  const incomingRes = await supabase
    .from('letters')
    .select('id, title, body, word_count, created_at, read_at, sender_id, recipient_id, sender:sender_id(id, handle), recipient:recipient_id(id, handle)')
    .eq('recipient_id', user.id)
    .is('recipient_deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100)

  const sentRes = await supabase
    .from('letters')
    .select('id, title, body, word_count, created_at, read_at, sender_id, recipient_id, sender:sender_id(id, handle), recipient:recipient_id(id, handle)')
    .eq('sender_id', user.id)
    .is('sender_deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100)

  const blocksRes = await supabase
    .from('letter_blocks')
    .select('blocked_id, created_at, blocked:blocked_id(id, handle)')
    .eq('blocker_id', user.id)
    .order('created_at', { ascending: false })

  const draftsRes = await supabase
    .from('letter_drafts')
    .select('id, recipient_handle, title, body, word_count, updated_at')
    .eq('author_id', user.id)
    .order('updated_at', { ascending: false })

  const incoming: LetterStub[] = ((incomingRes.data ?? []) as LetterRow[]).map(r => {
    const sender = flattenProfile(r.sender)
    return {
      id: r.id,
      title: r.title,
      body: r.body,
      word_count: r.word_count,
      created_at: r.created_at,
      read_at: r.read_at,
      direction: 'incoming',
      other_handle: sender?.handle ?? '?',
      other_id: sender?.id ?? '',
    }
  })

  const sent: LetterStub[] = ((sentRes.data ?? []) as LetterRow[]).map(r => {
    const recipient = flattenProfile(r.recipient)
    return {
      id: r.id,
      title: r.title,
      body: r.body,
      word_count: r.word_count,
      created_at: r.created_at,
      read_at: r.read_at,
      direction: 'outgoing',
      other_handle: recipient?.handle ?? '?',
      other_id: recipient?.id ?? '',
    }
  })

  const blocked: BlockedStub[] = ((blocksRes.data ?? []) as BlockRow[]).map(b => {
    const profile = flattenProfile(b.blocked)
    return {
      id: profile?.id ?? b.blocked_id,
      handle: profile?.handle ?? '?',
      created_at: b.created_at,
    }
  })

  const drafts: LetterDraftStub[] = (draftsRes.data ?? []) as LetterDraftStub[]

  const letters = box === 'sent' ? sent : incoming
  const unread = incoming.filter(l => !l.read_at).length

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', padding: '24px 20px' }}>
      <Link href="/" className="link" style={{ fontSize: 13, marginBottom: 18, display: 'inline-block' }}>
        ← back to front page
      </Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <pre className="ascii muted" style={{ fontSize: 13 }}>
{`┌─[ MAILROOM ]──────────────────`}
        </pre>
        <Link href="/mailroom/new" className="btn">▸ NEW LETTER</Link>
      </div>

      <LetterDraftsToggle drafts={drafts} />

      {justSent && (
        <div className="scheduled" style={{ marginBottom: 16 }}>
          <div className="positive" style={{ fontSize: 13 }}>✓ letter sent.</div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 14, fontSize: 12, marginBottom: 14 }}>
        {box === 'inbox' ? (
          <span style={{ fontWeight: 700 }}>
            INBOX {unread > 0 && <span className="accent">· {unread} new</span>}
          </span>
        ) : (
          <Link href="/mailroom" className="link">
            INBOX {unread > 0 && <span className="accent">· {unread} new</span>}
          </Link>
        )}
        <span className="muted">·</span>
        {box === 'sent' ? (
          <span style={{ fontWeight: 700 }}>SENT</span>
        ) : (
          <Link href="/mailroom?box=sent" className="link">SENT</Link>
        )}
      </div>

      <InboxList letters={letters} box={box} />

      <BlockList blocked={blocked} />

      <p className="muted" style={{ fontSize: 11.5, marginTop: 22, lineHeight: 1.6 }}>
        › letters are private. minimum 100 words, max 3 letters per day to the same person. mods can review reported letters.
      </p>
    </div>
  )
}

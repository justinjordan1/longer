import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { timeAgo, flagByValue } from '@/lib/longer'
import ModRowActions from './ModRowActions'

type ProfileRelation = { handle: string } | { handle: string }[] | null

type ReportRow = {
  post_id: string
  kind: 'hateful' | 'ai'
  profiles: ProfileRelation
}

type LetterReportRow = {
  id: string
  letter_id: string
  kind: 'hateful' | 'spam' | 'other'
  created_at: string
  profiles: ProfileRelation
}

type LetterRowForMod = {
  id: string
  title: string
  body: string
  created_at: string
  sender:    ProfileRelation
  recipient: ProfileRelation
}

type ModPostRow = {
  id: string
  title: string
  publish_at: string
  is_removed: boolean
  editorial_flag: string | null
  profiles: ProfileRelation
}

type RecentPostRow = ModPostRow & {
  up_count: number
  down_count: number
  comment_count: number
}

export default async function ModConsolePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('handle, is_mod')
    .eq('id', user.id)
    .single()

  if (!profile?.is_mod) {
    redirect('/')
  }

  const { data: reportedRaw } = await supabase
    .from('reports')
    .select('post_id, kind, profiles:reporter_id(handle)')
    .is('dismissed_at', null)

  const reportedByPost = new Map<string, { hateful: string[]; ai: string[] }>()
  for (const r of (reportedRaw ?? []) as ReportRow[]) {
    const handle = profileHandle(r.profiles)
    if (!reportedByPost.has(r.post_id)) {
      reportedByPost.set(r.post_id, { hateful: [], ai: [] })
    }
    reportedByPost.get(r.post_id)![r.kind].push(handle)
  }

  const reportedPostIds = Array.from(reportedByPost.keys())
  const { data: reportedPosts } = reportedPostIds.length > 0
    ? await supabase
        .from('posts')
        .select('id, title, publish_at, is_removed, editorial_flag, profiles:author_id(handle)')
        .in('id', reportedPostIds)
    : { data: [] }

  const { data: letterReportsRaw } = await supabase
    .from('letter_reports')
    .select('id, letter_id, kind, created_at, profiles:reporter_id(handle)')
    .is('dismissed_at', null)
    .order('created_at', { ascending: false })

  const letterReports = (letterReportsRaw ?? []) as LetterReportRow[]
  const reportedLetterIds = Array.from(new Set(letterReports.map(r => r.letter_id)))
  const { data: reportedLettersRaw } = reportedLetterIds.length > 0
    ? await supabase
        .from('letters')
        .select('id, title, body, created_at, sender:sender_id(handle), recipient:recipient_id(handle)')
        .in('id', reportedLetterIds)
    : { data: [] }

  const lettersById = new Map<string, LetterRowForMod>()
  for (const l of (reportedLettersRaw ?? []) as LetterRowForMod[]) {
    lettersById.set(l.id, l)
  }

  const reportsByLetter = new Map<string, LetterReportRow[]>()
  for (const r of letterReports) {
    if (!reportsByLetter.has(r.letter_id)) reportsByLetter.set(r.letter_id, [])
    reportsByLetter.get(r.letter_id)!.push(r)
  }

  const { data: recent } = await supabase
    .from('posts_with_metrics')
    .select('id, title, publish_at, is_removed, editorial_flag, up_count, down_count, comment_count, profiles!inner(handle)')
    .lte('publish_at', new Date().toISOString())
    .order('publish_at', { ascending: false })
    .limit(30)

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px' }}>
      <Link href="/" className="link" style={{ fontSize: 13, marginBottom: 18, display: 'inline-block' }}>
        ← back to front page
      </Link>

      <div className="panel mod-panel" style={{ marginBottom: 24 }}>
        <div className="panel-header">
          <span>┌── MOD CONSOLE ──┐</span>
          <span style={{ opacity: 0.85 }}>@{profile.handle}</span>
        </div>
        <div className="panel-body" style={{ padding: 16, fontSize: 13, lineHeight: 1.7 }}>
          <div>posts with open reports: <strong>{reportedByPost.size}</strong></div>
          <div className="muted" style={{ fontSize: 12 }}>
            › ai-language reports are aggregate signal only. they do not require action.
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 24 }}>
        <div className="panel-header">
          <span>REPORT QUEUE</span>
          <span className="muted">{reportedByPost.size}</span>
        </div>
        <div>
          {reportedByPost.size === 0 && (
            <div className="panel-body muted" style={{ fontSize: 13, fontStyle: 'italic' }}>
              › no open reports.
            </div>
          )}
          {((reportedPosts ?? []) as ModPostRow[]).map((p) => {
            const flag = flagByValue(p.editorial_flag)
            const reps = reportedByPost.get(p.id)!
            return (
              <div key={p.id} style={{ borderTop: '1px dashed var(--rule)', padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {p.is_removed
                        ? <span className="muted" style={{ fontStyle: 'italic' }}>[removed] {p.title}</span>
                        : p.title}
                      {flag && <span className="flag-badge">{flag.label}</span>}
                    </div>
                    <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>
                      <span className="accent">@</span>{profileHandle(p.profiles)} · {timeAgo(p.publish_at)} ago
                    </div>
                  </div>
                  <Link href={`/post/${p.id}`} className="link" style={{ fontSize: 12 }}>[open]</Link>
                </div>

                {reps.hateful.length > 0 && (
                  <div style={{ fontSize: 12, marginTop: 6 }}>
                    <span className="accent">! hateful ({reps.hateful.length}):</span>{' '}
                    <span className="muted">{reps.hateful.map(h => '@' + h).join(', ')}</span>{' · '}
                    <ModRowActions postId={p.id} action="dismiss" kind="hateful" />
                  </div>
                )}
                {reps.ai.length > 0 && (
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    <span className="caution">⚠ ai ({reps.ai.length}):</span>{' '}
                    <span className="muted">{reps.ai.map(h => '@' + h).join(', ')}</span>{' · '}
                    <ModRowActions postId={p.id} action="dismiss" kind="ai" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 24 }}>
        <div className="panel-header">
          <span>LETTER REPORTS</span>
          <span className="muted">{reportsByLetter.size}</span>
        </div>
        <div>
          {reportsByLetter.size === 0 && (
            <div className="panel-body muted" style={{ fontSize: 13, fontStyle: 'italic' }}>
              › no reported letters.
            </div>
          )}
          {Array.from(reportsByLetter.entries()).map(([letterId, reps]) => {
            const letter = lettersById.get(letterId)
            if (!letter) return null
            const sender = profileHandle(letter.sender)
            const recipient = profileHandle(letter.recipient)
            return (
              <div key={letterId} style={{ borderTop: '1px dashed var(--rule)', padding: 14 }}>
                <div className="muted" style={{ fontSize: 11.5, marginBottom: 4 }}>
                  <span className="accent">@</span>{sender} → <span className="accent">@</span>{recipient}
                  {' · '}{timeAgo(letter.created_at)} ago
                </div>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                  {letter.title || <span className="muted">[untitled letter]</span>}
                </div>
                <div className="muted" style={{ fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap', marginBottom: 8, maxHeight: 160, overflow: 'auto' }}>
                  {letter.body}
                </div>
                <div style={{ fontSize: 12 }}>
                  <span className="accent">! reports ({reps.length}):</span>{' '}
                  <span className="muted">
                    {reps.map(r => `@${profileHandle(r.profiles)} (${r.kind})`).join(', ')}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <span>RECENT POSTS</span>
          <span className="muted">latest {recent?.length ?? 0}</span>
        </div>
        <div>
          {(!recent || recent.length === 0) && (
            <div className="panel-body muted" style={{ fontSize: 13, fontStyle: 'italic' }}>
              › nothing published yet.
            </div>
          )}
          {((recent ?? []) as RecentPostRow[]).map((p) => {
            const flag = flagByValue(p.editorial_flag)
            return (
              <div key={p.id} style={{ borderTop: '1px dashed var(--rule)', padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                    {p.is_removed
                      ? <span className="muted" style={{ fontStyle: 'italic' }}>[removed] {p.title}</span>
                      : p.title}
                    {flag && <span className="flag-badge">{flag.label}</span>}
                  </div>
                  <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>
                    <span className="accent">@</span>{profileHandle(p.profiles)} · {timeAgo(p.publish_at)} ago · ↑{p.up_count} ↓{p.down_count} · {p.comment_count} replies
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {!p.is_removed
                    ? <ModRowActions postId={p.id} action="remove" />
                    : <ModRowActions postId={p.id} action="restore" />}
                  <Link href={`/post/${p.id}`} className="link" style={{ fontSize: 12 }}>[open]</Link>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function profileHandle(profile: ProfileRelation) {
  if (Array.isArray(profile)) return profile[0]?.handle ?? '?'
  return profile?.handle ?? '?'
}

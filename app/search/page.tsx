import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { timeAgo, flagByValue } from '@/lib/longer'
import SearchBox from './SearchBox'

export const metadata = { title: 'Search · LONGER' }

type Hit = {
  id: string
  title: string
  publish_at: string
  word_count: number
  is_removed: boolean
  editorial_flag: string | null
  handle: string
  snippet: string
}

type UserHit = {
  handle: string
  is_mod: boolean
  created_at: string
  post_count: number
}

type PostSearchRow = {
  id: string
  title: string
  body: string
  publish_at: string
  word_count: number
  is_removed: boolean
  editorial_flag: string | null
  profiles: { handle: string } | { handle: string }[] | null
}

function makeSnippet(body: string, q: string, max = 200): string {
  const lower = body.toLowerCase()
  const needle = q.toLowerCase().split(/\s+/).filter(Boolean)[0] ?? ''
  if (!needle) return body.slice(0, max) + (body.length > max ? '…' : '')
  const idx = lower.indexOf(needle)
  if (idx < 0) return body.slice(0, max) + (body.length > max ? '…' : '')
  const start = Math.max(0, idx - 80)
  const end   = Math.min(body.length, idx + 120)
  return (start > 0 ? '…' : '') + body.slice(start, end) + (end < body.length ? '…' : '')
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const params = await searchParams
  const q = (params.q ?? '').trim()

  const supabase = await createClient()
  let hits: Hit[] = []
  let users: UserHit[] = []
  let queried = false

  if (q.length > 0) {
    queried = true
    const handleQuery = q.replace(/^@/, '').toLowerCase()

    const [{ data }, { data: userRows }] = await Promise.all([
      supabase
      .from('posts')
      .select('id, title, body, publish_at, word_count, is_removed, editorial_flag, profiles:author_id(handle)')
      .lte('publish_at', new Date().toISOString())
      .eq('is_removed', false)
      .eq('post_visibility', 'feed')
      .textSearch('search_tsv', q, { type: 'websearch', config: 'english' })
      .order('publish_at', { ascending: false })
        .limit(50),
      supabase
        .from('profiles')
        .select('id, handle, is_mod, created_at')
        .ilike('handle', `%${handleQuery}%`)
        .order('handle', { ascending: true })
        .limit(12),
    ])

    hits = ((data ?? []) as PostSearchRow[]).map((p) => ({
      id: p.id,
      title: p.title,
      publish_at: p.publish_at,
      word_count: p.word_count,
      is_removed: p.is_removed,
      editorial_flag: p.editorial_flag,
      handle: profileHandle(p.profiles),
      snippet: makeSnippet(p.body, q),
    }))

    const profileRows = userRows ?? []
    if (profileRows.length > 0) {
      const { data: postCounts } = await supabase
        .from('posts')
        .select('author_id')
        .in('author_id', profileRows.map((profile) => profile.id))
        .lte('publish_at', new Date().toISOString())
        .eq('is_removed', false)
        .eq('post_visibility', 'feed')

      const counts = new Map<string, number>()
      for (const post of postCounts ?? []) {
        counts.set(post.author_id, (counts.get(post.author_id) ?? 0) + 1)
      }

      users = profileRows.map((profile) => ({
        handle: profile.handle,
        is_mod: profile.is_mod,
        created_at: profile.created_at,
        post_count: counts.get(profile.id) ?? 0,
      }))
    }
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 20px' }}>
      <Link href="/" className="link" style={{ fontSize: 13, marginBottom: 18, display: 'inline-block' }}>
        ← back to front page
      </Link>

      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-header"><span>┌── SEARCH ──┐</span></div>
        <div className="panel-body" style={{ padding: 18 }}>
          <SearchBox initial={q} />
        </div>
      </div>

      {queried && (
        <div className="panel">
          <div className="panel-header">
            <span>{users.length + hits.length} {users.length + hits.length === 1 ? 'RESULT' : 'RESULTS'}</span>
            <span className="muted">for &quot;{q}&quot;</span>
          </div>
          <div>
            {users.length === 0 && hits.length === 0 && (
              <div className="panel-body muted" style={{ fontSize: 13, fontStyle: 'italic' }}>
                › nothing matches. try fewer or different words.
              </div>
            )}
            {users.length > 0 && (
              <div style={{ borderBottom: hits.length > 0 ? '1px dashed var(--rule)' : undefined }}>
                <div className="panel-body smallcaps muted" style={{ fontSize: 11.5, paddingBottom: 6 }}>
                  users
                </div>
                {users.map((u, i) => (
                  <Link key={u.handle} href={`/u/${u.handle}`} className="post-row">
                    <div className="muted" style={{ fontSize: 12 }}>{String(i + 1).padStart(3, '0')} ▸</div>
                    <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35, margin: '2px 0 4px' }}>
                      <span className="accent">@</span>{u.handle}
                      {u.is_mod && <span className="flag-badge">mod</span>}
                    </div>
                    <div className="muted" style={{ fontSize: 11.5 }}>
                      {u.post_count} {u.post_count === 1 ? 'post' : 'posts'} · joined {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </div>
                  </Link>
                ))}
              </div>
            )}
            {hits.length > 0 && users.length > 0 && (
              <div className="panel-body smallcaps muted" style={{ fontSize: 11.5, paddingBottom: 6 }}>
                posts
              </div>
            )}
            {hits.map((h, i) => {
              const flag = flagByValue(h.editorial_flag)
              return (
                <Link key={h.id} href={`/post/${h.id}`} className="post-row">
                  <div className="muted" style={{ fontSize: 12 }}>{String(i + 1).padStart(3, '0')} ▸</div>
                  <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35, margin: '2px 0 4px' }}>
                    {h.title}
                    {flag && <span className="flag-badge">{flag.label}</span>}
                  </div>
                  <div className="muted" style={{ fontSize: 11.5, marginBottom: 6 }}>
                    <span className="accent">@</span>{h.handle} · {h.word_count} wd · {timeAgo(h.publish_at)}
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--ink-soft)' }}>
                    {h.snippet}
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {!queried && (
        <p className="muted" style={{ fontSize: 13, fontStyle: 'italic', marginTop: 14 }}>
          › type a query above. searches users, titles, and bodies of all published posts.
        </p>
      )}
    </div>
  )
}

function profileHandle(profile: PostSearchRow['profiles']) {
  if (Array.isArray(profile)) return profile[0]?.handle ?? '?'
  return profile?.handle ?? '?'
}

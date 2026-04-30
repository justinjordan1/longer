import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { timeAgo, flagByValue } from '@/lib/longer'
import LiveTimeUntil from './LiveTimeUntil'

type FeedPost = {
  id: string
  title: string
  publish_at: string
  word_count: number
  is_removed: boolean
  editorial_flag: string | null
  up_count: number
  down_count: number
  comment_count: number
  considered_score: number
  last_comment_at: string | null
  handle: string
}

export default async function FeedPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const nowIso = new Date().toISOString()

  // Query posts directly so the foreign key to profiles resolves.
  // Then merge in metrics via a parallel query on the view.
  const [postsRes, metricsRes] = await Promise.all([
    supabase
      .from('posts')
      .select('id, title, publish_at, word_count, is_removed, editorial_flag, profiles:author_id(handle)')
      .lte('publish_at', nowIso),
    supabase
      .from('post_metrics')
      .select('id, up_count, down_count, comment_count, last_comment_at'),
  ])

  const metricsById = new Map<string, any>()
  for (const m of metricsRes.data ?? []) {
    metricsById.set(m.id, m)
  }

  const visible: FeedPost[] = (postsRes.data ?? []).map((p: any) => {
    const m = metricsById.get(p.id) ?? {
      up_count: 0, down_count: 0, comment_count: 0, last_comment_at: null,
    }
    return {
      id: p.id,
      title: p.title,
      publish_at: p.publish_at,
      word_count: p.word_count,
      is_removed: p.is_removed,
      editorial_flag: p.editorial_flag,
      handle: p.profiles?.handle ?? '?',
      up_count: m.up_count,
      down_count: m.down_count,
      comment_count: m.comment_count,
      last_comment_at: m.last_comment_at,
      considered_score: (m.up_count - m.down_count) + m.comment_count * 3,
    }
  })

  // Your own scheduled (not yet published) posts
  const { data: scheduled } = await supabase
    .from('posts')
    .select('id, title, publish_at')
    .eq('author_id', user.id)
    .gt('publish_at', nowIso)
    .order('publish_at', { ascending: true })

  const newlyPosted    = [...visible].sort((a, b) => +new Date(b.publish_at) - +new Date(a.publish_at))
  const newlyDiscussed = [...visible]
    .filter(p => p.last_comment_at)
    .sort((a, b) => +new Date(b.last_comment_at!) - +new Date(a.last_comment_at!))
  const mostConsidered = [...visible].sort((a, b) => b.considered_score - a.considered_score)

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <pre className="ascii muted" style={{ fontSize: 13 }}>
{`┌─[ FRONT PAGE ]─────────────────`}
        </pre>
        <Link href="/compose" className="btn">▸ NEW</Link>
      </div>

      {scheduled && scheduled.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <p className="smallcaps muted" style={{ fontSize: 12, margin: '0 0 8px' }}>
            your scheduled
          </p>
          {scheduled.map(p => (
            <div key={p.id} className="scheduled">
              <div style={{ fontWeight: 600 }}>{p.title}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                publishes in <LiveTimeUntil iso={p.publish_at} whenPassed="any moment now" /> ·{' '}
                <Link href={`/compose?edit=${p.id}`} className="link" style={{ fontSize: 12 }}>edit</Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {visible.length === 0 && (!scheduled || scheduled.length === 0) && (
        <div className="panel" style={{ padding: 40, textAlign: 'center', marginTop: 20 }}>
          <pre className="ascii muted" style={{ fontSize: 11, marginBottom: 14 }}>
{`╔══════════════════════════╗
║                          ║
║     [ NO POSTS YET ]     ║
║                          ║
╚══════════════════════════╝`}
          </pre>
          <p className="muted">› the page is blank. write the first considered essay.</p>
        </div>
      )}

      {visible.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
        }}>
          <Column title="NEWLY POSTED"    posts={newlyPosted} />
          <Column title="NEWLY DISCUSSED" posts={newlyDiscussed} sortMeta={p => p.last_comment_at ? `last reply ${timeAgo(p.last_comment_at)}` : ''} />
          <Column title="MOST CONSIDERED" posts={mostConsidered} sortMeta={p => `considered: ${p.considered_score}`} headerHint="↑+(c×3)" />
        </div>
      )}
    </div>
  )
}

function Column({
  title,
  posts,
  sortMeta,
  headerHint,
}: {
  title: string
  posts: FeedPost[]
  sortMeta?: (p: FeedPost) => string
  headerHint?: string
}) {
  return (
    <div className="panel">
      <div className="panel-header">
        <span>{title}</span>
        <span className="muted">{headerHint ?? posts.length}</span>
      </div>
      <div>
        {posts.length === 0 ? (
          <div className="panel-body muted" style={{ fontSize: 12 }}>nothing here yet.</div>
        ) : (
          posts.map((p, i) => {
            const flag = flagByValue(p.editorial_flag)
            return (
              <Link key={p.id} href={`/post/${p.id}`} className="post-row">
                <div className="muted" style={{ fontSize: 12 }}>{String(i + 1).padStart(3, '0')} ▸</div>
                <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35, margin: '2px 0 4px', textDecoration: p.is_removed ? 'line-through' : 'none', color: p.is_removed ? 'var(--muted)' : 'inherit' }}>
                  {p.is_removed ? '[removed]' : p.title}
                  {flag && <span className="flag-badge">{flag.label}</span>}
                </div>
                <div className="muted" style={{ fontSize: 11.5 }}>
                  <span className="accent">@</span>{p.handle} · {p.word_count} wd · {timeAgo(p.publish_at)}
                </div>
                <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>
                  <span className="positive">↑{p.up_count}</span>{' '}
                  <span className="accent">↓{p.down_count}</span>{' · '}
                  {p.comment_count} {p.comment_count === 1 ? 'reply' : 'replies'}
                  {sortMeta && sortMeta(p) && <span> · {sortMeta(p)}</span>}
                </div>
              </Link>
            )
          })
        )}
      </div>
    </div>
  )
}

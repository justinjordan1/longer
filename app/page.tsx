import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { timeAgo, flagByValue } from '@/lib/longer'
import LiveTimeUntil from './LiveTimeUntil'
import FavoritesPrompt from './FavoritesPrompt'
import IntroBanner from './IntroBanner'
import DraftsToggle, { type DraftStub } from './DraftsToggle'
import GuestNewPrompt from './GuestNewPrompt'

const PAGE_SIZE = 10

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

type PostRow = {
  id: string
  title: string
  publish_at: string
  word_count: number
  is_removed: boolean
  editorial_flag: string | null
  profiles: { handle: string } | { handle: string }[] | null
}

type MetricRow = {
  up_count: number
  down_count: number
  comment_count: number
  last_comment_at: string | null
}

type VoteMetricRow = {
  post_id: string
  direction: 'up' | 'down'
}

type CommentMetricRow = {
  post_id: string
  created_at: string
}

type ProfilePromptRow = {
  handle: string
  dismissed_favorites_prompt: boolean
  dismissed_intro_banner: boolean
}

type ScheduledPost = {
  id: string
  title: string
  publish_at: string
}

type Window = 'week' | 'month' | 'all'

function parseWindow(s: string | undefined): Window {
  return s === 'month' || s === 'all' ? s : 'week'
}

function parsePage(s: string | undefined): number {
  const n = Number(s)
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1
}

function windowCutoff(w: Window): string | null {
  const now = Date.now()
  if (w === 'week')  return new Date(now - 7  * 24 * 3600 * 1000).toISOString()
  if (w === 'month') return new Date(now - 30 * 24 * 3600 * 1000).toISOString()
  return null
}

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ np?: string; nd?: string; mc?: string }>
}) {
  const params = await searchParams
  const npPage = parsePage(params.np)
  const ndPage = parsePage(params.nd)
  const mcWindow = parseWindow(params.mc)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const nowIso = new Date().toISOString()

  const postsRes = await supabase
    .from('posts')
    .select('id, title, publish_at, word_count, is_removed, editorial_flag, profiles:author_id(handle)')
    .lte('publish_at', nowIso)
    .eq('post_visibility', 'feed')

  const postRows = (postsRes.data ?? []) as PostRow[]
  const postIds = postRows.map(post => post.id)
  const [votesRes, commentMetricsRes] = postIds.length > 0
    ? await Promise.all([
        supabase
          .from('votes')
          .select('post_id, direction')
          .in('post_id', postIds),
        supabase
          .from('comments')
          .select('post_id, created_at')
          .in('post_id', postIds)
          .eq('is_removed', false),
      ])
    : [{ data: [] }, { data: [] }]

  let profile: ProfilePromptRow | null = null
  let favoriteCount = 0
  let drafts: DraftStub[] = []
  let scheduled: ScheduledPost[] = []
  let unreadLetters = 0

  if (user) {
    const [profileRes, favoritesRes, draftsRes, scheduledRes, unreadRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('handle, dismissed_favorites_prompt, dismissed_intro_banner')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('profile_favorites')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id),
      supabase
        .from('post_drafts')
        .select('id, title, body, word_count, updated_at')
        .eq('author_id', user.id)
        .order('updated_at', { ascending: false }),
      supabase
        .from('posts')
        .select('id, title, publish_at')
        .eq('author_id', user.id)
        .gt('publish_at', nowIso)
        .order('publish_at', { ascending: true }),
      supabase
        .from('letters')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .is('read_at', null)
        .is('recipient_deleted_at', null),
    ])

    profile = profileRes.data as ProfilePromptRow | null
    favoriteCount = favoritesRes.count ?? 0
    drafts = (draftsRes.data ?? []) as DraftStub[]
    scheduled = (scheduledRes.data ?? []) as ScheduledPost[]
    unreadLetters = unreadRes.count ?? 0
  }

  const shouldShowFavoritesPrompt =
    profile &&
    !profile.dismissed_favorites_prompt &&
    favoriteCount === 0
  const shouldShowIntroBanner = !profile?.dismissed_intro_banner

  const metricsById = new Map<string, MetricRow>()
  for (const postId of postIds) {
    metricsById.set(postId, {
      up_count: 0,
      down_count: 0,
      comment_count: 0,
      last_comment_at: null,
    })
  }

  for (const vote of (votesRes.data ?? []) as VoteMetricRow[]) {
    const metrics = metricsById.get(vote.post_id)
    if (!metrics) continue
    if (vote.direction === 'up') metrics.up_count += 1
    if (vote.direction === 'down') metrics.down_count += 1
  }

  for (const comment of (commentMetricsRes.data ?? []) as CommentMetricRow[]) {
    const metrics = metricsById.get(comment.post_id)
    if (!metrics) continue
    metrics.comment_count += 1
    if (!metrics.last_comment_at || comment.created_at > metrics.last_comment_at) {
      metrics.last_comment_at = comment.created_at
    }
  }

  const allPosts: FeedPost[] = postRows.map((p) => {
    const m = metricsById.get(p.id) ?? { up_count: 0, down_count: 0, comment_count: 0, last_comment_at: null }
    return {
      id: p.id,
      title: p.title,
      publish_at: p.publish_at,
      word_count: p.word_count,
      is_removed: p.is_removed,
      editorial_flag: p.editorial_flag,
      handle: profileHandle(p.profiles),
      up_count: m.up_count,
      down_count: m.down_count,
      comment_count: m.comment_count,
      last_comment_at: m.last_comment_at,
      considered_score: (m.up_count - m.down_count) + m.comment_count * 3,
    }
  })

  const npAll = [...allPosts].sort((a, b) => +new Date(b.publish_at) - +new Date(a.publish_at))
  const npTotal = npAll.length
  const npTotalPages = Math.max(1, Math.ceil(npTotal / PAGE_SIZE))
  const npClamped = Math.min(npPage, npTotalPages)
  const npSlice = npAll.slice((npClamped - 1) * PAGE_SIZE, npClamped * PAGE_SIZE)

  const ndAll = [...allPosts]
    .filter(p => p.last_comment_at)
    .sort((a, b) => +new Date(b.last_comment_at!) - +new Date(a.last_comment_at!))
  const ndTotal = ndAll.length
  const ndTotalPages = Math.max(1, Math.ceil(ndTotal / PAGE_SIZE))
  const ndClamped = Math.min(ndPage, ndTotalPages)
  const ndSlice = ndAll.slice((ndClamped - 1) * PAGE_SIZE, ndClamped * PAGE_SIZE)

  const cutoff = windowCutoff(mcWindow)
  const mcAll = allPosts
    .filter(p => !cutoff || p.publish_at >= cutoff)
    .sort((a, b) => b.considered_score - a.considered_score)
  const mcSlice = mcAll.slice(0, PAGE_SIZE)

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 20px' }}>
      {shouldShowIntroBanner && (
        <IntroBanner canDismiss={Boolean(profile)} />
      )}

      {profile && shouldShowFavoritesPrompt && (
        <FavoritesPrompt handle={profile.handle} />
      )}

      {user ? (
        <DraftsToggle drafts={drafts} unreadLetters={unreadLetters} />
      ) : (
        <GuestNewPrompt />
      )}

      {scheduled.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <p className="smallcaps muted" style={{ fontSize: 12, margin: '0 0 8px' }}>
            your scheduled
          </p>
          {scheduled.map(p => (
            <div key={p.id} className="scheduled">
              <div style={{ fontWeight: 600 }}>{p.title}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                publishes in <LiveTimeUntil iso={p.publish_at} whenPassed="any moment now" refreshOnExpire /> ·{' '}
                <Link href={`/compose?edit=${p.id}`} className="link" style={{ fontSize: 12 }}>edit</Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {allPosts.length === 0 && scheduled.length === 0 && (
        <div className="panel" style={{ padding: 40, textAlign: 'center', marginTop: 20 }}>
          <pre className="ascii muted" style={{ fontSize: 11, marginBottom: 14 }}>
{`╔══════════════════════════╗
║                          ║
║     [ NO POSTS YET ]     ║
║                          ║
╚══════════════════════════╝`}
          </pre>
          <p className="muted">
            › the page is blank. {user ? 'write the first considered essay.' : 'sign in/up to write the first considered essay.'}
          </p>
        </div>
      )}

      {allPosts.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
        }}>
          <Column
            title="NEWLY POSTED"
            posts={npSlice}
            startRank={(npClamped - 1) * PAGE_SIZE + 1}
            footer={
              <Pagination
                currentPage={npClamped}
                totalPages={npTotalPages}
                paramName="np"
                otherParams={{ nd: ndClamped, mc: mcWindow }}
              />
            }
          />
          <Column
            title="NEWLY DISCUSSED"
            posts={ndSlice}
            startRank={(ndClamped - 1) * PAGE_SIZE + 1}
            sortMeta={p => p.last_comment_at ? `last reply ${timeAgo(p.last_comment_at)}` : ''}
            footer={
              <Pagination
                currentPage={ndClamped}
                totalPages={ndTotalPages}
                paramName="nd"
                otherParams={{ np: npClamped, mc: mcWindow }}
              />
            }
          />
          <Column
            title="MOST CONSIDERED"
            posts={mcSlice}
            startRank={1}
            sortMeta={p => `considered: ${p.considered_score}`}
            headerHint="↑+(#replies×3)"
            footer={
              <WindowSwitcher
                current={mcWindow}
                otherParams={{ np: npClamped, nd: ndClamped }}
              />
            }
          />
        </div>
      )}
    </div>
  )
}

function Column({
  title,
  posts,
  startRank,
  sortMeta,
  headerHint,
  footer,
}: {
  title: string
  posts: FeedPost[]
  startRank: number
  sortMeta?: (p: FeedPost) => string
  headerHint?: string
  footer?: React.ReactNode
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
              <div key={p.id} className="post-row feed-post-row">
                <Link
                  href={`/post/${p.id}`}
                  className="feed-post-overlay"
                  aria-label={`read ${p.is_removed ? 'removed post' : p.title}`}
                />
                <div className="feed-post-content">
                  <div className="muted" style={{ fontSize: 12 }}>{String(startRank + i).padStart(3, '0')} ▸</div>
                  <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35, margin: '2px 0 4px', textDecoration: p.is_removed ? 'line-through' : 'none', color: p.is_removed ? 'var(--muted)' : 'inherit' }}>
                    {p.is_removed ? '[removed]' : p.title}
                    {flag && <span className="flag-badge">{flag.label}</span>}
                  </div>
                  <div className="muted" style={{ fontSize: 11.5 }}>
                    {p.handle === '?' ? (
                      <>
                        <span className="accent">@</span>{p.handle}
                      </>
                    ) : (
                      <Link href={`/u/${p.handle}`} className="feed-profile-link">
                        <span className="accent">@</span>{p.handle}
                      </Link>
                    )}{' '}
                    · {p.word_count} wd · {timeAgo(p.publish_at)}
                  </div>
                  <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>
                    <span className="positive">↑{p.up_count}</span>{' '}
                    <span className="accent">↓{p.down_count}</span>{' · '}
                    {p.comment_count} {p.comment_count === 1 ? 'reply' : 'replies'}
                    {sortMeta && sortMeta(p) && <span> · {sortMeta(p)}</span>}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
      {footer && (
        <div style={{ borderTop: '1px dashed var(--rule)', padding: '8px 10px' }}>
          {footer}
        </div>
      )}
    </div>
  )
}

function Pagination({
  currentPage,
  totalPages,
  paramName,
  otherParams,
}: {
  currentPage: number
  totalPages: number
  paramName: string
  otherParams: Record<string, string | number>
}) {
  if (totalPages <= 1) {
    return <div className="muted" style={{ fontSize: 11.5, textAlign: 'center' }}>page 1 of 1</div>
  }

  const buildHref = (page: number) => {
    const all = { ...otherParams, [paramName]: page }
    const qs = Object.entries(all)
      .filter(([, v]) => v !== undefined && v !== '' && v !== 1)
      .map(([k, v]) => `${k}=${v}`)
      .join('&')
    return qs ? `/?${qs}` : '/'
  }

  const windowSize = 5
  const initialStart = Math.max(1, currentPage - Math.floor(windowSize / 2))
  const end = Math.min(totalPages, initialStart + windowSize - 1)
  const start = Math.max(1, end - windowSize + 1)
  const pages: number[] = []
  for (let p = start; p <= end; p++) pages.push(p)

  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center', fontSize: 12, flexWrap: 'wrap' }}>
      {currentPage > 1 ? (
        <Link href={buildHref(currentPage - 1)} className="link">‹ prev</Link>
      ) : (
        <span className="muted">‹ prev</span>
      )}
      {pages.map(p => (
        p === currentPage
          ? <span key={p} style={{ fontWeight: 700 }}>{p}</span>
          : <Link key={p} href={buildHref(p)} className="link">{p}</Link>
      ))}
      {currentPage < totalPages ? (
        <Link href={buildHref(currentPage + 1)} className="link">next ›</Link>
      ) : (
        <span className="muted">next ›</span>
      )}
    </div>
  )
}

function WindowSwitcher({
  current,
  otherParams,
}: {
  current: Window
  otherParams: Record<string, string | number>
}) {
  const buildHref = (w: Window) => {
    const all: Record<string, string | number> = { ...otherParams }
    if (w !== 'week') all.mc = w   // 'week' is the default, omit from URL
    const qs = Object.entries(all)
      .filter(([, v]) => v !== undefined && v !== '' && v !== 1)
      .map(([k, v]) => `${k}=${v}`)
      .join('&')
    return qs ? `/?${qs}` : '/'
  }

  const renderWindowLink = (w: Window, label: string) => (
    w === current
      ? <span style={{ fontWeight: 700 }}>{label}</span>
      : <Link href={buildHref(w)} className="link">{label}</Link>
  )

  return (
    <div style={{ display: 'flex', gap: 12, justifyContent: 'center', fontSize: 12 }}>
      {renderWindowLink('week', 'week')}
      <span className="muted">·</span>
      {renderWindowLink('month', 'month')}
      <span className="muted">·</span>
      {renderWindowLink('all', 'all')}
    </div>
  )
}

function profileHandle(profile: PostRow['profiles']) {
  if (Array.isArray(profile)) return profile[0]?.handle ?? '?'
  return profile?.handle ?? '?'
}

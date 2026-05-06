import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { timeAgo, flagByValue } from '@/lib/longer'
import ProfilePinControls from './ProfilePinControls'

const PROFILE_POST_PAGE_SIZE = 4

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>
}) {
  const { handle } = await params
  return { title: `@${handle} · LONGER` }
}

type PostVisibility = 'feed' | 'profile'

type AuthorPost = {
  id: string
  title: string
  publish_at: string
  word_count: number
  is_removed: boolean
  editorial_flag: string | null
  post_visibility: PostVisibility
  profile_pin_position: number | null
}

type Favorite = {
  kind: 'book' | 'movie' | 'album'
  position: number
  external_id: string
  title: string
  subtitle: string | null
  cover_url: string | null
}

function parsePage(value: string | undefined) {
  const n = Number(value)
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1
}

function paginate<T>(items: T[], page: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / PROFILE_POST_PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  return {
    currentPage,
    totalPages,
    slice: items.slice((currentPage - 1) * PROFILE_POST_PAGE_SIZE, currentPage * PROFILE_POST_PAGE_SIZE),
  }
}

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>
  searchParams: Promise<{ pub?: string; pro?: string }>
}) {
  const { handle } = await params
  const query = await searchParams
  const publicPage = parsePage(query.pub)
  const profilePage = parsePage(query.pro)
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, handle, affiliation, created_at, is_mod')
    .eq('handle', handle.toLowerCase())
    .maybeSingle()

  if (!profile) notFound()

  const { data: { user } } = await supabase.auth.getUser()
  const isSelf = user?.id === profile.id

  const [postsRes, favRes] = await Promise.all([
    supabase
      .from('posts')
      .select('id, title, publish_at, word_count, is_removed, editorial_flag, post_visibility, profile_pin_position')
      .eq('author_id', profile.id)
      .lte('publish_at', new Date().toISOString())
      .eq('is_removed', false)
      .order('publish_at', { ascending: false }),
    supabase
      .from('profile_favorites')
      .select('kind, position, external_id, title, subtitle, cover_url')
      .eq('user_id', profile.id)
      .order('position', { ascending: true }),
  ])

  const posts: AuthorPost[] = ((postsRes.data ?? []) as AuthorPost[]).map(post => ({
    ...post,
    post_visibility: post.post_visibility === 'profile' ? 'profile' : 'feed',
  }))
  const pinned = posts
    .filter(post => post.profile_pin_position)
    .sort((a, b) => (a.profile_pin_position ?? 99) - (b.profile_pin_position ?? 99))
  const publicPosts = posts.filter(post => post.post_visibility === 'feed')
  const profilePosts = posts.filter(post => post.post_visibility === 'profile')
  const publicPostsPage = paginate(publicPosts, publicPage)
  const profilePostsPage = paginate(profilePosts, profilePage)

  const favs: Favorite[] = (favRes.data ?? []) as Favorite[]
  const books  = favs.filter(f => f.kind === 'book')
  const movies = favs.filter(f => f.kind === 'movie')
  const albums = favs.filter(f => f.kind === 'album')

  const joined = new Date(profile.created_at)
  const joinedLabel = joined.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '24px 20px' }}>
      <Link href="/" className="link" style={{ fontSize: 13, marginBottom: 18, display: 'inline-block' }}>
        ← back to front page
      </Link>

      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-header">
          <span>┌── PROFILE ──┐</span>
          {isSelf && (
            <Link href={`/u/${profile.handle}/edit`} className="link" style={{ fontSize: 12, color: 'var(--ink)' }}>
              [edit favorites]
            </Link>
          )}
        </div>
        <div className="panel-body" style={{ padding: 24 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 6px' }}>
            <span className="accent">@</span>{profile.handle}
            {profile.is_mod && <span className="flag-badge" style={{ marginLeft: 10 }}>mod</span>}
          </h1>
          <p className="muted" style={{ fontSize: 13, margin: 0 }}>
            joined {joinedLabel} · {posts.length} {posts.length === 1 ? 'post' : 'posts'}
          </p>
        </div>
      </div>

      {pinned.length > 0 && (
        <div className="panel" style={{ marginBottom: 18 }}>
          <div className="panel-header">
            <span>PINNED</span>
            <span className="muted">{pinned.length}/3</span>
          </div>
          <div>
            {pinned.map((post, index) => (
              <ProfilePostRow
                key={post.id}
                post={post}
                index={index + 1}
                isSelf={isSelf}
              />
            ))}
          </div>
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: 16,
        marginBottom: 18,
      }}>
        <ProfilePostColumn
          title="PUBLIC POSTS"
          count={publicPosts.length}
          posts={publicPostsPage.slice}
          empty="› no main-feed posts yet."
          page={publicPostsPage.currentPage}
          totalPages={publicPostsPage.totalPages}
          paramName="pub"
          otherParams={{ pro: profilePostsPage.currentPage }}
          handle={profile.handle}
          isSelf={isSelf}
          startIndex={(publicPostsPage.currentPage - 1) * PROFILE_POST_PAGE_SIZE + 1}
        />
        <ProfilePostColumn
          title="PROFILE-ONLY"
          count={profilePosts.length}
          posts={profilePostsPage.slice}
          empty="› no profile-only posts yet."
          page={profilePostsPage.currentPage}
          totalPages={profilePostsPage.totalPages}
          paramName="pro"
          otherParams={{ pub: publicPostsPage.currentPage }}
          handle={profile.handle}
          isSelf={isSelf}
          startIndex={(profilePostsPage.currentPage - 1) * PROFILE_POST_PAGE_SIZE + 1}
        />
      </div>

      {(books.length > 0 || movies.length > 0 || albums.length > 0) && (
        <div className="panel" style={{ maxWidth: 800, margin: '0 auto 18px' }}>
          <div className="panel-header">
            <span>FAVORITES</span>
          </div>
          <div className="panel-body" style={{ padding: 18 }}>
            <FavoritesGrid kind="book"  items={books} />
            <FavoritesGrid kind="movie" items={movies} />
            <FavoritesGrid kind="album" items={albums} />
          </div>
        </div>
      )}
    </div>
  )
}

function ProfilePostColumn({
  title,
  count,
  posts,
  empty,
  page,
  totalPages,
  paramName,
  otherParams,
  handle,
  isSelf,
  startIndex,
}: {
  title: string
  count: number
  posts: AuthorPost[]
  empty: string
  page: number
  totalPages: number
  paramName: 'pub' | 'pro'
  otherParams: Record<string, string | number>
  handle: string
  isSelf: boolean
  startIndex: number
}) {
  return (
    <div className="panel">
      <div className="panel-header">
        <span>{title}</span>
        <span className="muted">{count}</span>
      </div>
      <div>
        {posts.length === 0 && (
          <div className="panel-body muted" style={{ fontSize: 13, fontStyle: 'italic' }}>
            {empty}
          </div>
        )}
        {posts.map((post, index) => (
          <ProfilePostRow
            key={post.id}
            post={post}
            index={startIndex + index}
            isSelf={isSelf}
          />
        ))}
      </div>
      <div style={{ borderTop: '1px dashed var(--rule)', padding: '8px 10px' }}>
        <ProfilePagination
          handle={handle}
          currentPage={page}
          totalPages={totalPages}
          paramName={paramName}
          otherParams={otherParams}
        />
      </div>
    </div>
  )
}

function ProfilePostRow({
  post,
  index,
  isSelf,
}: {
  post: AuthorPost
  index: number
  isSelf: boolean
}) {
  const flag = flagByValue(post.editorial_flag)
  return (
    <div className="post-row">
      <Link href={`/post/${post.id}`} style={{ color: 'inherit', textDecoration: 'none', display: 'block' }}>
        <div className="muted" style={{ fontSize: 12 }}>{String(index).padStart(3, '0')} ▸</div>
        <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35, margin: '2px 0 4px' }}>
          {post.title}
          {flag && <span className="flag-badge">{flag.label}</span>}
          {post.post_visibility === 'profile' && <span className="flag-badge">profile</span>}
        </div>
        <div className="muted" style={{ fontSize: 11.5 }}>
          {post.word_count} wd · {timeAgo(post.publish_at)} ago
          {post.profile_pin_position && <span> · pinned {post.profile_pin_position}</span>}
        </div>
      </Link>
      {isSelf && (
        <ProfilePinControls
          postId={post.id}
          currentPosition={post.profile_pin_position}
        />
      )}
    </div>
  )
}

function ProfilePagination({
  handle,
  currentPage,
  totalPages,
  paramName,
  otherParams,
}: {
  handle: string
  currentPage: number
  totalPages: number
  paramName: 'pub' | 'pro'
  otherParams: Record<string, string | number>
}) {
  if (totalPages <= 1) {
    return <div className="muted" style={{ fontSize: 11.5, textAlign: 'center' }}>page 1 of 1</div>
  }

  const buildHref = (page: number) => {
    const all = { ...otherParams, [paramName]: page }
    const qs = Object.entries(all)
      .filter(([, value]) => value !== undefined && value !== '' && value !== 1)
      .map(([key, value]) => `${key}=${value}`)
      .join('&')
    return qs ? `/u/${handle}?${qs}` : `/u/${handle}`
  }

  const pages: number[] = []
  const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4))
  const end = Math.min(totalPages, Math.max(5, currentPage + 2))
  for (let page = start; page <= end; page++) pages.push(page)

  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center', fontSize: 12, flexWrap: 'wrap' }}>
      {currentPage > 1 ? (
        <Link href={buildHref(currentPage - 1)} className="link">‹ prev</Link>
      ) : (
        <span className="muted">‹ prev</span>
      )}
      {pages.map(page => (
        page === currentPage
          ? <span key={page} style={{ fontWeight: 700 }}>{page}</span>
          : <Link key={page} href={buildHref(page)} className="link">{page}</Link>
      ))}
      {currentPage < totalPages ? (
        <Link href={buildHref(currentPage + 1)} className="link">next ›</Link>
      ) : (
        <span className="muted">next ›</span>
      )}
    </div>
  )
}

function FavoritesGrid({ kind, items }: { kind: 'book' | 'movie' | 'album'; items: Favorite[] }) {
  if (items.length === 0) return null
  const label = kind === 'book' ? 'BOOKS' : kind === 'movie' ? 'MOVIES' : 'ALBUMS'
  const slots = Array.from({ length: 5 }, (_, index) => {
    const position = index + 1
    return items.find(item => item.position === position) ?? null
  })

  return (
    <div style={{ marginBottom: kind === 'album' ? 0 : 22 }}>
      <p className="smallcaps muted" style={{ fontSize: 11, margin: '0 0 10px' }}>{label}</p>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
        gap: 10,
      }}>
        {slots.map((f, index) => (
          <div key={index + 1} style={{ fontSize: 11.5, lineHeight: 1.4, minWidth: 0 }}>
            {f ? (
              <>
                <div style={{
                  aspectRatio: kind === 'album' ? '1 / 1' : '2 / 3',
                  background: 'var(--paper-2)',
                  border: '1px solid var(--rule)',
                  marginBottom: 6,
                  backgroundImage: f.cover_url ? `url(${f.cover_url})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }} />
                <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.title}</div>
                {f.subtitle && <div className="muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.subtitle}</div>}
              </>
            ) : (
              <div style={{
                aspectRatio: kind === 'album' ? '1 / 1' : '2 / 3',
                background: 'var(--paper-2)',
                border: '1px dashed var(--rule)',
                opacity: 0.55,
              }} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

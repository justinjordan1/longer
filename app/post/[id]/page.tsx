import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { timeAgo, flagByValue } from '@/lib/longer'
import PostInteractions from './PostInteractions'

type ProfileRelation = { handle: string } | { handle: string }[] | null

type PostRow = {
  id: string
  title: string
  body: string
  word_count: number
  created_at: string
  publish_at: string
  is_removed: boolean
  editorial_flag: string | null
  author_id: string
  post_visibility: string
  profiles: ProfileRelation
}

type ReportRow = {
  kind: 'hateful' | 'ai'
  profiles: ProfileRelation
}

type CommentRow = {
  id: string
  body: string
  word_count: number
  created_at: string
  parent_comment_id: string | null
  profiles: ProfileRelation
}

type VoteCountRow = {
  direction: 'up' | 'down'
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [postRes, commentsRes, votesRes] = await Promise.all([
    supabase
      .from('posts')
      .select(`
        id, title, body, word_count, created_at, publish_at,
        is_removed, editorial_flag, author_id, post_visibility,
        profiles:author_id ( handle )
      `)
      .eq('id', id)
      .lte('publish_at', new Date().toISOString())
      .maybeSingle(),
    supabase
      .from('comments')
      .select('id, body, word_count, created_at, parent_comment_id, profiles:author_id(handle)')
      .eq('post_id', id)
      .eq('is_removed', false)
      .order('created_at', { ascending: true }),
    supabase
      .from('votes')
      .select('direction')
      .eq('post_id', id),
  ])

  const post = postRes.data as PostRow | null
  if (!post) notFound()

  let myProfile: { handle: string; is_mod: boolean } | null = null
  let myReports: { kind: 'hateful' | 'ai' }[] = []
  let myVote: 'up' | 'down' | null = null

  if (user) {
    const [myProfileRes, myReportsRes, myVoteRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('handle, is_mod')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('reports')
        .select('kind')
        .eq('post_id', id)
        .eq('reporter_id', user.id),
      supabase
        .from('votes')
        .select('direction')
        .eq('post_id', id)
        .eq('user_id', user.id)
        .maybeSingle(),
    ])

    myProfile = myProfileRes.data
    myReports = (myReportsRes.data ?? []) as { kind: 'hateful' | 'ai' }[]
    myVote = (myVoteRes.data?.direction as 'up' | 'down' | undefined) ?? null
  }

  const publicVotes = (votesRes.data ?? []) as VoteCountRow[]
  const upCount = publicVotes.filter(vote => vote.direction === 'up').length
  const downCount = publicVotes.filter(vote => vote.direction === 'down').length
  const flag      = flagByValue(post.editorial_flag)

  let modReports: { hateful: string[]; ai: string[] } | null = null
  if (myProfile?.is_mod) {
    const { data: openRep } = await supabase
      .from('reports')
      .select('kind, profiles:reporter_id(handle)')
      .eq('post_id', id)
      .is('dismissed_at', null)
    const reportRows = (openRep ?? []) as ReportRow[]
    modReports = {
      hateful: reportRows.filter(r => r.kind === 'hateful').map(r => profileHandle(r.profiles)),
      ai:      reportRows.filter(r => r.kind === 'ai').map(r => profileHandle(r.profiles)),
    }
  }

  const authorHandle = profileHandle(post.profiles)

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 20px' }}>
      <Link href="/" className="link" style={{ fontSize: 13, marginBottom: 18, display: 'inline-block' }}>
        ← back to front page
      </Link>

      <article className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-header">
          <span>┌── ESSAY ──┐</span>
          <span className="muted">{post.word_count} words</span>
        </div>
        <div className="panel-body" style={{ padding: 24 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.3, margin: '0 0 12px' }}>
            {post.is_removed
              ? <span className="muted" style={{ fontStyle: 'italic' }}>[removed]</span>
              : post.title}
            {flag && <span className="flag-badge">{flag.label}</span>}
          </h1>
          <p className="muted" style={{ fontSize: 12, margin: '0 0 22px' }}>
            by <Link href={`/u/${authorHandle}`} style={{ color: 'inherit', textDecoration: 'underline', textUnderlineOffset: 3 }}><span className="accent">@</span>{authorHandle}</Link> · published {timeAgo(post.publish_at)} ago
            {post.post_visibility === 'profile' && <span> · profile-only</span>}
          </p>
          {flag && (
            <p className="caution" style={{ fontSize: 13, margin: '0 0 20px', fontStyle: 'italic' }}>
              › editor&apos;s note: {flag.note}
            </p>
          )}
          {post.is_removed ? (
            <div className="removed-banner">
              [ this post has been removed by a moderator ]
            </div>
          ) : (
            <div className="essay-prose">
              {post.body.split(/\n\n+/).map((para: string, i: number) => (
                <p key={i}>{renderInlineFormatting(para)}</p>
              ))}
            </div>
          )}
        </div>
      </article>

      {!post.is_removed && (
        <PostInteractions
          postId={post.id}
          upCount={upCount}
          downCount={downCount}
          myVote={myVote as 'up' | 'down' | null}
          comments={((commentsRes.data ?? []) as CommentRow[]).map((c) => ({
            id: c.id,
            body: c.body,
            word_count: c.word_count,
            created_at: c.created_at,
            parent_comment_id: c.parent_comment_id,
            handle: profileHandle(c.profiles),
          }))}
          myReports={{
            hateful: !!myReports?.find(r => r.kind === 'hateful'),
            ai:      !!myReports?.find(r => r.kind === 'ai'),
          }}
          isMod={myProfile?.is_mod ?? false}
          currentFlag={post.editorial_flag}
          modReports={modReports}
          canInteract={!!myProfile}
        />
      )}
    </div>
  )
}

function profileHandle(profile: ProfileRelation) {
  if (Array.isArray(profile)) return profile[0]?.handle ?? '?'
  return profile?.handle ?? '?'
}

function renderInlineFormatting(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)

  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i}>{part.slice(1, -1)}</em>
    }
    return part
  })
}

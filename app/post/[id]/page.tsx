import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { timeAgo, flagByValue, countWords } from '@/lib/longer'
import PostInteractions from './PostInteractions'

export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: post } = await supabase
    .from('posts')
    .select(`
      id, title, body, word_count, created_at, publish_at,
      is_removed, editorial_flag, author_id,
      profiles:author_id ( handle )
    `)
    .eq('id', id)
    .maybeSingle()

  if (!post) notFound()

  const { data: comments } = await supabase
    .from('comments')
    .select('id, body, word_count, created_at, profiles:author_id(handle)')
    .eq('post_id', id)
    .eq('is_removed', false)
    .order('created_at', { ascending: true })

  const { data: votes } = await supabase
    .from('votes')
    .select('user_id, direction')
    .eq('post_id', id)

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('handle, is_mod')
    .eq('id', user.id)
    .single()

  const { data: myReports } = await supabase
    .from('reports')
    .select('kind')
    .eq('post_id', id)
    .eq('reporter_id', user.id)

  const upCount   = votes?.filter(v => v.direction === 'up').length   ?? 0
  const downCount = votes?.filter(v => v.direction === 'down').length ?? 0
  const myVote    = votes?.find(v => v.user_id === user.id)?.direction ?? null
  const flag      = flagByValue(post.editorial_flag)

  // Mod-only: open reports breakdown
  let modReports: { hateful: string[]; ai: string[] } | null = null
  if (myProfile?.is_mod) {
    const { data: openRep } = await supabase
      .from('reports')
      .select('kind, profiles:reporter_id(handle)')
      .eq('post_id', id)
      .is('dismissed_at', null)
    modReports = {
      hateful: (openRep ?? []).filter((r: any) => r.kind === 'hateful').map((r: any) => r.profiles?.handle ?? '?'),
      ai:      (openRep ?? []).filter((r: any) => r.kind === 'ai').map((r: any) => r.profiles?.handle ?? '?'),
    }
  }

  const authorHandle = (post.profiles as any)?.handle ?? '?'

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
            by <span className="accent">@</span>{authorHandle} · published {timeAgo(post.publish_at)} ago
          </p>
          {flag && (
            <p className="caution" style={{ fontSize: 13, margin: '0 0 20px', fontStyle: 'italic' }}>
              › editor's note: {flag.note}
            </p>
          )}
          {post.is_removed ? (
            <div className="removed-banner">
              [ this post has been removed by a moderator ]
            </div>
          ) : (
            <div className="essay-prose">
              {post.body.split(/\n\n+/).map((para: string, i: number) => (
                <p key={i}>{para}</p>
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
          comments={(comments ?? []).map((c: any) => ({
            id: c.id,
            body: c.body,
            word_count: c.word_count,
            created_at: c.created_at,
            handle: c.profiles?.handle ?? '?',
          }))}
          myReports={{
            hateful: !!myReports?.find(r => r.kind === 'hateful'),
            ai:      !!myReports?.find(r => r.kind === 'ai'),
          }}
          isMod={myProfile?.is_mod ?? false}
          currentFlag={post.editorial_flag}
          modReports={modReports}
        />
      )}
    </div>
  )
}

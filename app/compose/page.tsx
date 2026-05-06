import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ComposeForm from './ComposeForm'

export default async function ComposePage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; draft?: string }>
}) {
  const params = await searchParams
  const editId = params.edit
  const draftId = params.draft

  if (!editId && !draftId) {
    return <ComposeForm mode="new" />
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  if (draftId) {
    const { data: draft } = await supabase
      .from('post_drafts')
      .select('id, author_id, title, body, post_visibility, updated_at')
      .eq('id', draftId)
      .maybeSingle()

    if (!draft) redirect('/')
    if (draft.author_id !== user.id) redirect('/')

    return (
      <ComposeForm
        mode="draft"
        draftId={draft.id}
        initialTitle={draft.title}
        initialBody={draft.body}
        postVisibility={draft.post_visibility === 'profile' ? 'profile' : 'feed'}
        updatedAt={draft.updated_at}
      />
    )
  }

  const { data: post } = await supabase
    .from('posts')
    .select('id, author_id, title, body, publish_at, post_visibility, is_removed')
    .eq('id', editId)
    .maybeSingle()

  if (!post)                                 redirect('/')
  if (post.author_id !== user.id)            redirect('/')
  if (post.is_removed)                       redirect('/')
  if (new Date(post.publish_at) <= new Date()) redirect(`/post/${editId}`)

  return (
    <ComposeForm
      mode="edit"
      postId={post.id}
      initialTitle={post.title}
      initialBody={post.body}
      publishAt={post.publish_at}
      postVisibility={post.post_visibility === 'profile' ? 'profile' : 'feed'}
    />
  )
}

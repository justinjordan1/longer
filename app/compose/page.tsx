import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ComposeForm from './ComposeForm'

export default async function ComposePage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>
}) {
  const params = await searchParams
  const editId = params.edit

  if (!editId) {
    return <ComposeForm mode="new" />
  }

  // Edit mode — load the existing post and verify it's editable
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: post } = await supabase
    .from('posts')
    .select('id, author_id, title, body, publish_at, is_removed')
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
    />
  )
}

'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { POST_MIN_WORDS, COMMENT_MIN_WORDS, countWords } from '@/lib/longer'

const POST_DELAY_MIN = 15

export async function createPost(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'not authenticated' }

  const title = String(formData.get('title') || '').trim()
  const body  = String(formData.get('body')  || '').trim()
  const wordCount = countWords(body)

  if (!title || title.length > 200) {
    return { error: 'title required (max 200 chars)' }
  }
  if (wordCount < POST_MIN_WORDS) {
    return { error: `${POST_MIN_WORDS - wordCount} more words needed` }
  }

  const publishAt = new Date(Date.now() + POST_DELAY_MIN * 60 * 1000).toISOString()

  const { error } = await supabase.from('posts').insert({
    author_id:  user.id,
    title,
    body,
    word_count: wordCount,
    publish_at: publishAt,
  })

  if (error) {
    if (error.message.includes('post_throttle')) {
      return { error: 'you can only post once per 24 hours' }
    }
    return { error: error.message }
  }

  revalidatePath('/')
  redirect('/')
}

export async function createComment(postId: string, body: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'not authenticated' }

  const trimmed = body.trim()
  const wordCount = countWords(trimmed)
  if (wordCount < COMMENT_MIN_WORDS) {
    return { error: `${COMMENT_MIN_WORDS - wordCount} more words needed` }
  }

  const { error } = await supabase.from('comments').insert({
    post_id:    postId,
    author_id:  user.id,
    body:       trimmed,
    word_count: wordCount,
  })

  if (error) {
    if (error.message.includes('comment_cooldown')) {
      return { error: 'cooldown active — wait an hour between comments' }
    }
    return { error: error.message }
  }

  revalidatePath(`/post/${postId}`)
  return { success: true }
}

export async function castVote(
  postId: string,
  direction: 'up' | 'down' | null,
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'not authenticated' }

  if (direction === null) {
    const { error } = await supabase
      .from('votes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', user.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase
      .from('votes')
      .upsert({ post_id: postId, user_id: user.id, direction })
    if (error) return { error: error.message }
  }

  revalidatePath(`/post/${postId}`)
  revalidatePath('/')
  return { success: true }
}

export async function fileReport(postId: string, kind: 'hateful' | 'ai') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'not authenticated' }

  const { error } = await supabase.from('reports').insert({
    post_id: postId,
    reporter_id: user.id,
    kind,
  })
  // 23505 = unique violation (already reported); treat as success
  if (error && error.code !== '23505') return { error: error.message }

  revalidatePath(`/post/${postId}`)
  return { success: true }
}

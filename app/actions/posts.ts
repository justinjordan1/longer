'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { POST_MIN_WORDS, COMMENT_MIN_WORDS, countWords } from '@/lib/longer'

const POST_DELAY_MIN = 5
type PostVisibility = 'feed' | 'profile'

function readPostVisibility(formData: FormData): PostVisibility {
  return formData.get('post_visibility') === 'profile' ? 'profile' : 'feed'
}

function readPostForm(formData: FormData) {
  const title = String(formData.get('title') || '').trim()
  const body  = String(formData.get('body')  || '').trim()
  const wordCount = countWords(body)
  const postVisibility = readPostVisibility(formData)

  return { title, body, wordCount, postVisibility }
}

export async function createPost(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'not authenticated' }

  const { title, body, wordCount, postVisibility } = readPostForm(formData)

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
    post_visibility: postVisibility,
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

export async function savePostDraft(draftId: string | null, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'not authenticated' }

  const { title, body, wordCount, postVisibility } = readPostForm(formData)
  if (title.length > 200) return { error: 'title max 200 chars' }
  if (!title && !body) return { error: 'write something before saving' }

  if (draftId) {
    const { data: existing } = await supabase
      .from('post_drafts')
      .select('id, author_id')
      .eq('id', draftId)
      .maybeSingle()

    if (!existing) return { error: 'draft not found' }
    if (existing.author_id !== user.id) return { error: 'not your draft' }

    const { error } = await supabase
      .from('post_drafts')
      .update({
        title,
        body,
        word_count: wordCount,
        post_visibility: postVisibility,
        updated_at: new Date().toISOString(),
      })
      .eq('id', draftId)
      .eq('author_id', user.id)

    if (error) return { error: error.message }
    revalidatePath('/')
    revalidatePath('/compose')
    return { success: true, draftId }
  }

  const { data, error } = await supabase
    .from('post_drafts')
    .insert({
      author_id: user.id,
      title,
      body,
      word_count: wordCount,
      post_visibility: postVisibility,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath('/')
  revalidatePath('/compose')
  return { success: true, draftId: data.id as string }
}

export async function submitPostDraft(draftId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'not authenticated' }

  const { data: existing } = await supabase
    .from('post_drafts')
    .select('id, author_id')
    .eq('id', draftId)
    .maybeSingle()

  if (!existing) return { error: 'draft not found' }
  if (existing.author_id !== user.id) return { error: 'not your draft' }

  const { title, body, wordCount, postVisibility } = readPostForm(formData)
  if (!title || title.length > 200) {
    return { error: 'title required (max 200 chars)' }
  }
  if (wordCount < POST_MIN_WORDS) {
    return { error: `${POST_MIN_WORDS - wordCount} more words needed` }
  }

  const publishAt = new Date(Date.now() + POST_DELAY_MIN * 60 * 1000).toISOString()
  const { error: insertError } = await supabase.from('posts').insert({
    author_id: user.id,
    title,
    body,
    word_count: wordCount,
    publish_at: publishAt,
    post_visibility: postVisibility,
  })

  if (insertError) {
    if (insertError.message.includes('post_throttle')) {
      return { error: 'you can only post once per 24 hours' }
    }
    return { error: insertError.message }
  }

  await supabase
    .from('post_drafts')
    .delete()
    .eq('id', draftId)
    .eq('author_id', user.id)

  revalidatePath('/')
  redirect('/')
}

export async function discardPostDraft(draftId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'not authenticated' }

  const { error } = await supabase
    .from('post_drafts')
    .delete()
    .eq('id', draftId)
    .eq('author_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/')
  return { success: true }
}

export async function updateScheduledPost(postId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'not authenticated' }

  const { title, body, wordCount, postVisibility } = readPostForm(formData)

  if (!title || title.length > 200) {
    return { error: 'title required (max 200 chars)' }
  }
  if (wordCount < POST_MIN_WORDS) {
    return { error: `${POST_MIN_WORDS - wordCount} more words needed` }
  }

  const { data: existing } = await supabase
    .from('posts')
    .select('id, author_id, publish_at')
    .eq('id', postId)
    .maybeSingle()

  if (!existing)                            return { error: 'post not found' }
  if (existing.author_id !== user.id)       return { error: 'not your post' }
  if (new Date(existing.publish_at) <= new Date())
                                            return { error: 'review window has closed' }

  const { error } = await supabase
    .from('posts')
    .update({ title, body, word_count: wordCount, post_visibility: postVisibility })
    .eq('id', postId)
    .eq('author_id', user.id)
    .gt('publish_at', new Date().toISOString())

  if (error) return { error: error.message }

  revalidatePath('/')
  redirect('/')
}

export async function setProfilePostPin(postId: string, position: number | null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'not authenticated' }

  if (position !== null && (position < 1 || position > 3)) {
    return { error: 'pin position must be between 1 and 3' }
  }

  const { error } = await supabase.rpc('set_profile_post_pin', {
    p_post_id: postId,
    p_position: position,
  })

  if (error) return { error: error.message }

  const { data: profile } = await supabase
    .from('profiles')
    .select('handle')
    .eq('id', user.id)
    .single()

  revalidatePath('/')
  if (profile?.handle) revalidatePath(`/u/${profile.handle}`)

  return { success: true }
}

export async function discardScheduledPost(postId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'not authenticated' }

  const { data: existing } = await supabase
    .from('posts')
    .select('id, author_id, publish_at')
    .eq('id', postId)
    .maybeSingle()

  if (!existing)                            return { error: 'post not found' }
  if (existing.author_id !== user.id)       return { error: 'not your post' }
  if (new Date(existing.publish_at) <= new Date())
                                            return { error: 'too late to discard' }

  const { error } = await supabase
    .from('posts')
    .delete()
    .eq('id', postId)
    .eq('author_id', user.id)
    .gt('publish_at', new Date().toISOString())

  if (error) return { error: error.message }

  revalidatePath('/')
  return { success: true }
}

export async function createComment(
  postId: string,
  body: string,
  parentCommentId?: string | null,
) {
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
    parent_comment_id: parentCommentId ?? null,
  })

  if (error) {
    if (error.message.includes('comment_cooldown')) {
      return { error: 'cooldown active — wait an hour between comments' }
    }
    if (error.message.includes('nested deeper')) {
      return { error: 'replies cannot be nested further' }
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
  if (error && error.code !== '23505') return { error: error.message }

  revalidatePath(`/post/${postId}`)
  return { success: true }
}

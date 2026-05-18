'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { LETTER_MIN_WORDS, countWords } from '@/lib/longer'

type LetterReportKind = 'hateful' | 'spam' | 'other'

function readLetterForm(formData: FormData) {
  const recipient = String(formData.get('recipient') || '').trim().replace(/^@/, '')
  const title = String(formData.get('title') || '').trim()
  const body  = String(formData.get('body')  || '').trim()
  const replyToRaw = String(formData.get('reply_to') || '').trim()
  const replyTo = replyToRaw || null
  return { recipient, title, body, wordCount: countWords(body), replyTo }
}

async function resolveRecipient(supabase: Awaited<ReturnType<typeof createClient>>, handle: string) {
  return supabase
    .from('profiles')
    .select('id, handle')
    .ilike('handle', handle)
    .maybeSingle()
}

export async function sendLetter(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'not authenticated' }

  const draftIdRaw = String(formData.get('draft_id') || '').trim()
  const draftId = draftIdRaw || null

  const { recipient, title, body, wordCount } = readLetterForm(formData)

  if (!recipient) return { error: 'recipient handle required' }
  if (title.length > 200) return { error: 'title max 200 chars' }
  if (wordCount < LETTER_MIN_WORDS) {
    return { error: `${LETTER_MIN_WORDS - wordCount} more words needed` }
  }

  const { data: recipientProfile } = await resolveRecipient(supabase, recipient)

  if (!recipientProfile) return { error: `no such user @${recipient}` }
  if (recipientProfile.id === user.id) return { error: 'you cannot send a letter to yourself' }

  const { error } = await supabase.from('letters').insert({
    sender_id: user.id,
    recipient_id: recipientProfile.id,
    title,
    body,
    word_count: wordCount,
  })

  if (error) {
    if (error.message.includes('letter_blocked')) {
      return { error: `@${recipientProfile.handle} is not accepting letters from you` }
    }
    if (error.message.includes('letter_throttle')) {
      return { error: `you've reached the daily letter limit to @${recipientProfile.handle}` }
    }
    return { error: error.message }
  }

  if (draftId) {
    await supabase
      .from('letter_drafts')
      .delete()
      .eq('id', draftId)
      .eq('author_id', user.id)
  }

  revalidatePath('/mailroom')
  revalidatePath('/')
  redirect('/mailroom?sent=1')
}

export async function saveLetterDraft(draftId: string | null, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'not authenticated' }

  const { recipient, title, body, wordCount, replyTo } = readLetterForm(formData)
  if (title.length > 200) return { error: 'title max 200 chars' }
  if (!recipient && !title && !body) return { error: 'write something before saving' }

  if (draftId) {
    const { data: existing } = await supabase
      .from('letter_drafts')
      .select('id, author_id')
      .eq('id', draftId)
      .maybeSingle()
    if (!existing) return { error: 'draft not found' }
    if (existing.author_id !== user.id) return { error: 'not your draft' }

    const { error } = await supabase
      .from('letter_drafts')
      .update({
        recipient_handle: recipient,
        title,
        body,
        word_count: wordCount,
        reply_to_letter_id: replyTo,
        updated_at: new Date().toISOString(),
      })
      .eq('id', draftId)
      .eq('author_id', user.id)
    if (error) return { error: error.message }

    revalidatePath('/mailroom')
    return { success: true, draftId }
  }

  const { data, error } = await supabase
    .from('letter_drafts')
    .insert({
      author_id: user.id,
      recipient_handle: recipient,
      title,
      body,
      word_count: wordCount,
      reply_to_letter_id: replyTo,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath('/mailroom')
  return { success: true, draftId: data.id as string }
}

export async function discardLetterDraft(draftId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'not authenticated' }

  const { error } = await supabase
    .from('letter_drafts')
    .delete()
    .eq('id', draftId)
    .eq('author_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/mailroom')
  return { success: true }
}

export async function markLetterRead(letterId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'not authenticated' }

  const { error } = await supabase.rpc('mark_letter_read', { p_letter_id: letterId })
  if (error) return { error: error.message }

  revalidatePath('/mailroom')
  revalidatePath('/')
  return { success: true }
}

export async function deleteLetterFromInbox(letterId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'not authenticated' }

  const { error } = await supabase.rpc('soft_delete_letter', { p_letter_id: letterId })
  if (error) return { error: error.message }

  revalidatePath('/mailroom')
  return { success: true }
}

export async function blockSender(senderHandle: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'not authenticated' }

  const handle = senderHandle.trim().replace(/^@/, '')
  if (!handle) return { error: 'handle required' }

  const { data: target } = await resolveRecipient(supabase, handle)

  if (!target) return { error: `no such user @${handle}` }
  if (target.id === user.id) return { error: 'you cannot block yourself' }

  const { error } = await supabase
    .from('letter_blocks')
    .insert({ blocker_id: user.id, blocked_id: target.id })

  if (error && error.code !== '23505') return { error: error.message }

  revalidatePath('/mailroom')
  return { success: true, handle: target.handle }
}

export async function unblockSender(blockedId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'not authenticated' }

  const { error } = await supabase
    .from('letter_blocks')
    .delete()
    .eq('blocker_id', user.id)
    .eq('blocked_id', blockedId)

  if (error) return { error: error.message }

  revalidatePath('/mailroom')
  return { success: true }
}

export async function reportLetter(letterId: string, kind: LetterReportKind) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'not authenticated' }

  const { data: letter } = await supabase
    .from('letters')
    .select('id, recipient_id')
    .eq('id', letterId)
    .maybeSingle()

  if (!letter) return { error: 'letter not found' }
  if (letter.recipient_id !== user.id) return { error: 'only the recipient can report' }

  const { error } = await supabase.from('letter_reports').insert({
    letter_id: letterId,
    reporter_id: user.id,
    kind,
  })
  if (error && error.code !== '23505') return { error: error.message }

  revalidatePath('/mailroom')
  return { success: true }
}

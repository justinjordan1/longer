'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { countWords } from '@/lib/longer'

type LetterReportKind = 'hateful' | 'spam' | 'other'

function readLetterForm(formData: FormData) {
  const recipient = String(formData.get('recipient') || '').trim().replace(/^@/, '')
  const title = String(formData.get('title') || '').trim()
  const body  = String(formData.get('body')  || '').trim()
  return { recipient, title, body, wordCount: countWords(body) }
}

export async function sendLetter(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'not authenticated' }

  const { recipient, title, body, wordCount } = readLetterForm(formData)

  if (!recipient) return { error: 'recipient handle required' }
  if (title.length > 200) return { error: 'title max 200 chars' }
  if (!body) return { error: 'write something before sending' }

  const { data: recipientProfile } = await supabase
    .from('profiles')
    .select('id, handle')
    .ilike('handle', recipient)
    .maybeSingle()

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

  revalidatePath('/mailroom')
  revalidatePath('/')
  redirect('/mailroom?sent=1')
}

export async function markLetterRead(letterId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'not authenticated' }

  const { error } = await supabase
    .from('letters')
    .update({ read_at: new Date().toISOString() })
    .eq('id', letterId)
    .eq('recipient_id', user.id)
    .is('read_at', null)

  if (error) return { error: error.message }

  revalidatePath('/mailroom')
  revalidatePath('/')
  return { success: true }
}

export async function deleteLetterFromInbox(letterId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'not authenticated' }

  const nowIso = new Date().toISOString()
  const { data: letter } = await supabase
    .from('letters')
    .select('id, sender_id, recipient_id')
    .eq('id', letterId)
    .maybeSingle()

  if (!letter) return { error: 'letter not found' }

  const column =
    letter.recipient_id === user.id ? 'recipient_deleted_at'
    : letter.sender_id === user.id  ? 'sender_deleted_at'
    : null

  if (!column) return { error: 'not your letter' }

  const { error } = await supabase
    .from('letters')
    .update({ [column]: nowIso })
    .eq('id', letterId)

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

  const { data: target } = await supabase
    .from('profiles')
    .select('id, handle')
    .ilike('handle', handle)
    .maybeSingle()

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

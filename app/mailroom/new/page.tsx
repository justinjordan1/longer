import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ComposeLetterForm, { type ReplyContext } from './ComposeLetterForm'

type ProfileRel = { id: string; handle: string } | { id: string; handle: string }[] | null

type LetterFetchRow = {
  id: string
  title: string
  body: string
  created_at: string
  word_count: number
  sender_id: string
  recipient_id: string
  sender: ProfileRel
}

function flattenProfile(p: ProfileRel) {
  if (Array.isArray(p)) return p[0] ?? null
  return p
}

export default async function NewLetterPage({
  searchParams,
}: {
  searchParams: Promise<{ to?: string; draft?: string; reply?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/mailroom/new')

  let initialRecipient = (params.to || '').trim().replace(/^@/, '')
  let initialTitle = ''
  let initialBody = ''
  let draftId: string | null = null
  let replyContext: ReplyContext | null = null

  if (params.draft) {
    const { data: draft } = await supabase
      .from('letter_drafts')
      .select('id, author_id, recipient_handle, title, body, reply_to_letter_id')
      .eq('id', params.draft)
      .maybeSingle()
    if (!draft) redirect('/mailroom')
    if (draft.author_id !== user.id) redirect('/mailroom')
    draftId = draft.id
    initialRecipient = draft.recipient_handle || initialRecipient
    initialTitle = draft.title
    initialBody  = draft.body
    if (draft.reply_to_letter_id) {
      replyContext = await loadReplyContext(supabase, draft.reply_to_letter_id, user.id)
    }
  }

  if (!replyContext && params.reply) {
    replyContext = await loadReplyContext(supabase, params.reply, user.id)
    if (replyContext && !initialRecipient) {
      initialRecipient = replyContext.fromHandle
    }
  }

  return (
    <ComposeLetterForm
      initialRecipient={initialRecipient}
      initialTitle={initialTitle}
      initialBody={initialBody}
      draftId={draftId}
      reply={replyContext}
    />
  )
}

async function loadReplyContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  letterId: string,
  userId: string,
): Promise<ReplyContext | null> {
  const { data } = await supabase
    .from('letters')
    .select('id, title, body, created_at, word_count, sender_id, recipient_id, sender:sender_id(id, handle)')
    .eq('id', letterId)
    .maybeSingle()

  const letter = data as LetterFetchRow | null
  if (!letter) return null
  if (letter.recipient_id !== userId) return null // only the recipient may reply with split-screen context

  const sender = flattenProfile(letter.sender)
  return {
    id:         letter.id,
    title:      letter.title,
    body:       letter.body,
    createdAt:  letter.created_at,
    wordCount:  letter.word_count,
    fromHandle: sender?.handle ?? '?',
  }
}

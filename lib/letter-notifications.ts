import { createAdminClient } from './supabase/admin'
import { createUnsubscribeToken } from './unsubscribe'
import { sendLetterNotification } from './email'

type NotifyArgs = {
  recipientId: string
  recipientHandle: string
  senderHandle: string
  title: string
  wordCount: number
}

// Best-effort: a letter that is already in the recipient's mailroom must not
// fail to send because an email provider is down, so every path here returns
// rather than throws, and the caller ignores the result.
export async function notifyLetterRecipient(args: NotifyArgs): Promise<void> {
  const admin = createAdminClient()
  if (!admin) return

  const { data: prefs, error: prefsError } = await admin
    .from('profiles')
    .select('letter_email_notifications')
    .eq('id', args.recipientId)
    .maybeSingle()

  // Fail closed: if the preference can't be read (most likely the migration
  // hasn't been applied yet), stay quiet rather than mail someone who has no
  // working way to opt out.
  if (prefsError) {
    console.error(`[letter-email] preference lookup failed: ${prefsError.message}`)
    return
  }
  if (prefs?.letter_email_notifications === false) return

  const { data: account } = await admin.auth.admin.getUserById(args.recipientId)
  const to = account?.user?.email
  if (!to) return

  const token = createUnsubscribeToken(args.recipientId)
  if (!token) return

  const result = await sendLetterNotification({
    to,
    recipientHandle: args.recipientHandle,
    senderHandle: args.senderHandle,
    title: args.title,
    wordCount: args.wordCount,
    unsubscribeToken: token,
  })

  if (result.error) {
    console.error(`[letter-email] delivery to @${args.recipientHandle} failed: ${result.error}`)
  }
}

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

// Every exit says why. A notification that quietly does nothing is
// indistinguishable from one that is broken.
function log(message: string) {
  console.log(`[letter-email] ${message}`)
}

// Best-effort: a letter that is already in the recipient's mailroom must not
// fail to send because an email provider is down, so every path here returns
// rather than throws, and the caller ignores the result.
export async function notifyLetterRecipient(args: NotifyArgs): Promise<void> {
  const to_ = `@${args.recipientHandle}`

  const admin = createAdminClient()
  if (!admin) {
    log(`skipped ${to_}: SUPABASE_SERVICE_ROLE_KEY is not set`)
    return
  }

  const { data: prefs, error: prefsError } = await admin
    .from('profiles')
    .select('letter_email_notifications')
    .eq('id', args.recipientId)
    .maybeSingle()

  // Fail closed: if the preference can't be read (most likely the migration
  // hasn't been applied yet, or PostgREST is still serving a stale schema
  // cache), stay quiet rather than mail someone who has no working way to
  // opt out.
  if (prefsError) {
    log(`skipped ${to_}: preference lookup failed (${prefsError.message})`)
    return
  }
  if (prefs?.letter_email_notifications === false) {
    log(`skipped ${to_}: recipient has letter emails turned off`)
    return
  }

  const { data: account, error: accountError } = await admin.auth.admin.getUserById(args.recipientId)
  if (accountError) {
    log(`skipped ${to_}: account lookup failed (${accountError.message})`)
    return
  }

  const to = account?.user?.email
  if (!to) {
    log(`skipped ${to_}: no email address on the account`)
    return
  }

  const token = createUnsubscribeToken(args.recipientId)
  if (!token) {
    log(`skipped ${to_}: could not sign an unsubscribe token`)
    return
  }

  const result = await sendLetterNotification({
    to,
    recipientHandle: args.recipientHandle,
    senderHandle: args.senderHandle,
    title: args.title,
    wordCount: args.wordCount,
    unsubscribeToken: token,
  })

  if (result.skipped) log(`skipped ${to_}: ${result.skipped}`)
  else if (result.error) console.error(`[letter-email] delivery to ${to_} failed: ${result.error}`)
  else log(`sent to ${to_}`)
}

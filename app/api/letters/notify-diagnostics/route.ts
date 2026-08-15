import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createUnsubscribeToken } from '@/lib/unsubscribe'
import { siteUrl } from '@/lib/site'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Temporary: answers "why did no email go out" without depending on log
// delivery. Mod-only, read-only, and reports whether secrets are *present*,
// never their values. Delete once the notification path is confirmed working.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'sign in' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('handle, is_mod')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.is_mod) return NextResponse.json({ error: 'mods only' }, { status: 403 })

  const env = {
    RESEND_API_KEY: process.env.RESEND_API_KEY ? 'present' : 'MISSING',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'present' : 'MISSING',
    LETTER_EMAIL_FROM: process.env.LETTER_EMAIL_FROM ?? '(unset, falling back to default)',
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? '(unset)',
    resolved_site_url: siteUrl(),
  }

  // does the preference column actually answer through PostgREST?
  const admin = createAdminClient()
  let preferenceCheck: unknown = 'skipped: no service-role client'
  let addressCheck: unknown = 'skipped: no service-role client'
  let updateCheck: unknown = 'skipped: preference read failed'

  if (admin) {
    const { data, error } = await admin
      .from('profiles')
      .select('letter_email_notifications')
      .eq('id', user.id)
      .maybeSingle()

    preferenceCheck = error
      ? { ok: false, error: error.message, hint: 'this is the fail-closed path that suppresses sends' }
      : { ok: true, your_setting: data?.letter_email_notifications }

    const { data: account, error: accountError } = await admin.auth.admin.getUserById(user.id)
    addressCheck = accountError
      ? { ok: false, error: accountError.message }
      : { ok: true, has_address: Boolean(account?.user?.email) }

    // The unsubscribe endpoint writes as service_role for a user with no
    // session. Write the value back unchanged: a grant problem surfaces as an
    // error, and RLS blocking the role surfaces as zero rows touched.
    if (!error) {
      const { data: written, error: writeError } = await admin
        .from('profiles')
        .update({ letter_email_notifications: data?.letter_email_notifications ?? true })
        .eq('id', user.id)
        .select('id')

      updateCheck = writeError
        ? { ok: false, error: writeError.message }
        : written && written.length > 0
          ? { ok: true, rows_touched: written.length }
          : { ok: false, error: 'zero rows touched -- RLS is blocking service_role writes' }
    }
  }

  // is the Resend key accepted? listing domains proves the key without sending.
  let resendCheck: unknown = 'skipped: no RESEND_API_KEY'
  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/domains', {
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
        signal: AbortSignal.timeout(8000),
      })
      resendCheck = { ok: res.ok, status: res.status }
    } catch (e) {
      resendCheck = { ok: false, error: e instanceof Error ? e.message : 'unknown' }
    }
  }

  return NextResponse.json({
    env,
    preferenceCheck,
    updateCheck,
    addressCheck,
    resendCheck,
    unsubscribeTokenSigning: createUnsubscribeToken(user.id) ? 'ok' : 'FAILED (no service-role key)',
  }, { status: 200 })
}

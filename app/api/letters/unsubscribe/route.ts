import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyUnsubscribeToken } from '@/lib/unsubscribe'

export const runtime = 'nodejs'

// RFC 8058 one-click unsubscribe target, named in the List-Unsubscribe header.
// Mail clients POST here without a session, so the token is the only proof of
// identity — and it only ever turns notifications off.
export async function POST(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('t')
  const userId = verifyUnsubscribeToken(token)
  if (!userId) {
    return NextResponse.json({ error: 'invalid token' }, { status: 400 })
  }

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json({ error: 'unsubscribe unavailable' }, { status: 500 })
  }

  const { error } = await admin
    .from('profiles')
    .update({ letter_email_notifications: false })
    .eq('id', userId)

  if (error) {
    return NextResponse.json({ error: 'could not unsubscribe' }, { status: 500 })
  }

  return NextResponse.json({ unsubscribed: true })
}

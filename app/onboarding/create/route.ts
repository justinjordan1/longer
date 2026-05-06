import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const HANDLE_RE = /^[a-z0-9_]{3,20}$/

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'not signed in' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const handle = String(body?.handle ?? '').trim().toLowerCase()

  if (!HANDLE_RE.test(handle)) {
    return NextResponse.json({ error: 'invalid handle' }, { status: 400 })
  }

  const email = user.email?.toLowerCase() ?? ''
  const accessMethod = email.endsWith('@gatech.edu')
    ? 'gatech'
    : 'google'

  const { error } = await supabase.from('profiles').insert({
    id: user.id,
    handle,
    access_method: accessMethod,
  })

  if (error) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.code === '23505' ? 409 : 400 }
    )
  }

  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no-code`)
  }

  const supabase = await createClient()
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
  if (exchangeError) {
    return NextResponse.redirect(`${origin}/login?error=${exchangeError.message}`)
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=no-user`)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('handle, access_method')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) {
    return NextResponse.redirect(`${origin}/onboarding`)
  }

  await supabase
    .from('profiles')
    .update({ last_signin_at: new Date().toISOString() })
    .eq('id', user.id)

  return NextResponse.redirect(`${origin}/`)
}

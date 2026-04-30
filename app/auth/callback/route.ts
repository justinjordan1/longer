import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

  // Defense in depth — even though the Azure tenant URL restricts to GT,
  // verify the email domain server-side too.
  if (!user.email?.toLowerCase().endsWith('@gatech.edu')) {
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/login?error=non-gatech-email`)
  }

  // First-time users have no profile row yet; send to onboarding.
  const { data: profile } = await supabase
    .from('profiles')
    .select('handle')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) {
    return NextResponse.redirect(`${origin}/onboarding`)
  }

  // Returning user — bump their last_signin_at and send home.
  await supabase
    .from('profiles')
    .update({ last_signin_at: new Date().toISOString() })
    .eq('id', user.id)

  return NextResponse.redirect(`${origin}/`)
}

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  // Public routes — login page and the OAuth callback chain
  const isPublic = path === '/login' || path === '/guidelines' || path.startsWith('/auth/')

  // Not signed in: only public routes are reachable
  if (!user) {
    if (isPublic) return response
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Signed in: figure out if they have a profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  const isOnboarding = path === '/onboarding'

  // Has profile, on onboarding page → send home
  if (profile && isOnboarding) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // No profile, not on onboarding → force them there
  if (!profile && !isOnboarding) {
    return NextResponse.redirect(new URL('/onboarding', request.url))
  }

  // Everything fine — let it through
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.).*)'],
}

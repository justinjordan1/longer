import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  if (request.nextUrl.hostname === 'www.longerwords.com') {
    const url = request.nextUrl.clone()
    url.hostname = 'longerwords.com'
    return NextResponse.redirect(url, 308)
  }

  const proto = request.headers.get('x-forwarded-proto')
  if (process.env.NODE_ENV === 'production' && proto === 'http') {
    const url = request.nextUrl.clone()
    url.protocol = 'https:'
    return NextResponse.redirect(url, 308)
  }

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

  const isOnboarding = path === '/onboarding' || path === '/onboarding/create'
  const isProfileEdit = /^\/u\/[^/]+\/edit(?:\/.*)?$/.test(path)

  const isPublicRead =
    path === '/' ||
    path === '/login' ||
    path === '/beta' ||
    path === '/guidelines' ||
    path === '/search' ||
    path.startsWith('/post/') ||
    (path.startsWith('/u/') && !isProfileEdit) ||
    path.startsWith('/auth/')

  if (!user) {
    if (isPublicRead) return response
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, access_method')
    .eq('id', user.id)
    .maybeSingle()

  if (profile && isOnboarding) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  if (!profile && !isOnboarding) {
    return NextResponse.redirect(new URL('/onboarding', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.).*)'],
}

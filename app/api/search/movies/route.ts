import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type TmdbMovie = {
  id?: number
  title?: string
  release_date?: string
  poster_path?: string | null
}

type TmdbSearchResponse = {
  results?: TmdbMovie[]
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const token = process.env.TMDB_READ_ACCESS_TOKEN
  if (!token) {
    return NextResponse.json({ error: 'TMDB_READ_ACCESS_TOKEN not configured' }, { status: 500 })
  }

  const q = (request.nextUrl.searchParams.get('q') ?? '').trim()
  if (!q) return NextResponse.json({ results: [] })

  const url = new URL('https://api.themoviedb.org/3/search/movie')
  url.searchParams.set('query', q)
  url.searchParams.set('include_adult', 'false')
  url.searchParams.set('page', '1')

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      next: { revalidate: 60 * 60 },
    })
    if (!res.ok) {
      return NextResponse.json({ error: `tmdb returned ${res.status}` }, { status: 502 })
    }
    const data = await res.json() as TmdbSearchResponse
    const results = (data.results ?? [])
      .filter((d): d is TmdbMovie & { id: number; title: string } => Boolean(d.id && d.title))
      .slice(0, 8)
      .map((d) => ({
      external_id: String(d.id),
      title: d.title,
      subtitle: d.release_date ? `(${d.release_date.slice(0, 4)})` : '',
      cover_url: d.poster_path
        ? `https://image.tmdb.org/t/p/w185${d.poster_path}`
        : null,
    }))
    return NextResponse.json({ results })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unexpected movie search error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type OpenLibraryDoc = {
  key?: string
  title?: string
  author_name?: string[]
  first_publish_year?: number
  cover_i?: number
}

type OpenLibraryResponse = {
  docs?: OpenLibraryDoc[]
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const q = (request.nextUrl.searchParams.get('q') ?? '').trim()
  if (!q) return NextResponse.json({ results: [] })

  const url = new URL('https://openlibrary.org/search.json')
  url.searchParams.set('q', q)
  url.searchParams.set('limit', '8')
  url.searchParams.set('fields', 'key,title,author_name,first_publish_year,cover_i')

  try {
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'longerwords.com (longer)' },
      next: { revalidate: 60 * 60 },
    })
    if (!res.ok) {
      return NextResponse.json({ error: `open library returned ${res.status}` }, { status: 502 })
    }
    const data = await res.json() as OpenLibraryResponse
    const results = (data.docs ?? [])
      .filter((d): d is OpenLibraryDoc & { key: string; title: string } => Boolean(d.key && d.title))
      .map((d) => ({
      external_id: d.key,
      title: d.title,
      subtitle: [
        (d.author_name ?? [])[0],
        d.first_publish_year ? `(${d.first_publish_year})` : null,
      ].filter(Boolean).join(' '),
      cover_url: d.cover_i
        ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg`
        : null,
    }))
    return NextResponse.json({ results })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unexpected book search error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type LastFmImage = {
  '#text'?: string
  size?: string
}

type LastFmAlbum = {
  name?: string
  artist?: string
  mbid?: string
  url?: string
  image?: LastFmImage[]
}

type LastFmResponse = {
  results?: {
    albummatches?: {
      album?: LastFmAlbum | LastFmAlbum[]
    }
  }
}

function bestImage(images: LastFmImage[] | undefined) {
  return [...(images ?? [])]
    .reverse()
    .map((image) => image['#text']?.trim())
    .find(Boolean) ?? null
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const apiKey = process.env.LASTFM_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'LASTFM_API_KEY not configured' }, { status: 500 })
  }

  const q = (request.nextUrl.searchParams.get('q') ?? '').trim()
  if (!q) return NextResponse.json({ results: [] })

  const url = new URL('https://ws.audioscrobbler.com/2.0/')
  url.searchParams.set('method', 'album.search')
  url.searchParams.set('album', q)
  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('format', 'json')
  url.searchParams.set('limit', '8')

  try {
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'longerwords.com (longer)' },
      next: { revalidate: 60 * 60 },
    })
    if (!res.ok) {
      return NextResponse.json({ error: `last.fm returned ${res.status}` }, { status: 502 })
    }

    const data = (await res.json()) as LastFmResponse
    const rawAlbums = data.results?.albummatches?.album ?? []
    const albums = Array.isArray(rawAlbums) ? rawAlbums : [rawAlbums]
    const results = albums
      .filter((album) => album.name)
      .map((album) => ({
        external_id: album.mbid || album.url || `${album.artist ?? 'unknown'}:${album.name!}`,
        title: album.name!,
        subtitle: album.artist ?? '',
        cover_url: bestImage(album.image),
      }))

    return NextResponse.json({ results })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'album search failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

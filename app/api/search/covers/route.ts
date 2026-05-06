import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Kind = 'book' | 'album'

type OpenLibraryWork = {
  covers?: number[]
}

type OpenLibrarySearch = {
  docs?: {
    cover_i?: number
    isbn?: string[]
  }[]
}

type ITunesSearch = {
  results?: {
    artworkUrl100?: string
    artistName?: string
    collectionName?: string
  }[]
}

type MusicBrainzSearch = {
  'release-groups'?: {
    id?: string
  }[]
}

type CoverArtArchiveResponse = {
  images?: {
    front?: boolean
    image?: string
    thumbnails?: {
      '500'?: string
      large?: string
    }
  }[]
}

type CoverInput = {
  kind: Kind
  external_id: string
  title: string
  subtitle: string | null
}

function cleanSubtitle(subtitle: string | null) {
  return subtitle?.replace(/\s*\(\d{4}\)\s*$/, '').trim() ?? ''
}

function normalizeImageUrl(url: string | undefined) {
  return url ? url.replace(/^http:\/\//, 'https://') : null
}

function openLibraryCoverUrl(coverId: number | undefined) {
  return coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : null
}

function isbnCoverUrl(isbn: string | undefined) {
  return isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg?default=false` : null
}

function normalizeLookupText(value: string | null | undefined) {
  return value
    ?.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim() ?? ''
}

function isLooseTextMatch(actual: string, expected: string) {
  if (!actual || !expected) return false
  return actual === expected || actual.includes(expected) || expected.includes(actual)
}

async function findBookCover(input: CoverInput) {
  const author = cleanSubtitle(input.subtitle)

  if (input.external_id.startsWith('/works/') || input.external_id.startsWith('/books/')) {
    const res = await fetch(`https://openlibrary.org${input.external_id}.json`, {
      headers: { 'User-Agent': 'longerwords.com (longer)' },
      next: { revalidate: 60 * 60 * 24 },
    })
    if (res.ok) {
      const data = (await res.json()) as OpenLibraryWork
      const cover = openLibraryCoverUrl(data.covers?.[0])
      if (cover) return { cover_url: cover, source: 'open-library-work' }
    }
  }

  const url = new URL('https://openlibrary.org/search.json')
  url.searchParams.set('title', input.title)
  if (author) url.searchParams.set('author', author)
  url.searchParams.set('limit', '5')
  url.searchParams.set('fields', 'cover_i,isbn')

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'longerwords.com (longer)' },
    next: { revalidate: 60 * 60 * 24 },
  })
  if (!res.ok) return { cover_url: null, source: null }

  const data = (await res.json()) as OpenLibrarySearch
  for (const doc of data.docs ?? []) {
    const cover = openLibraryCoverUrl(doc.cover_i) ?? isbnCoverUrl(doc.isbn?.[0])
    if (cover) return { cover_url: cover, source: 'open-library-search' }
  }

  return { cover_url: null, source: null }
}

async function findITunesAlbumCover(input: CoverInput) {
  const artist = cleanSubtitle(input.subtitle)
  const titleNeedle = normalizeLookupText(input.title)
  const artistNeedle = normalizeLookupText(artist)

  const url = new URL('https://itunes.apple.com/search')
  url.searchParams.set('term', [input.title, artist].filter(Boolean).join(' '))
  url.searchParams.set('media', 'music')
  url.searchParams.set('entity', 'album')
  url.searchParams.set('limit', '10')

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'longerwords.com (longer)' },
    next: { revalidate: 60 * 60 * 24 },
  })
  if (!res.ok) return { cover_url: null, source: null }

  const data = (await res.json()) as ITunesSearch
  const match = (data.results ?? []).find((item) => {
    const itemTitle = normalizeLookupText(item.collectionName)
    const itemArtist = normalizeLookupText(item.artistName)
    return isLooseTextMatch(itemTitle, titleNeedle) && (!artistNeedle || isLooseTextMatch(itemArtist, artistNeedle))
  })
  const cover = normalizeImageUrl(match?.artworkUrl100?.replace(/100x100bb\.jpg$/, '600x600bb.jpg'))
  return cover ? { cover_url: cover, source: 'itunes' } : { cover_url: null, source: null }
}

async function findMusicBrainzAlbumCover(input: CoverInput) {
  const artist = cleanSubtitle(input.subtitle)
  const query = artist
    ? `release:"${input.title}" AND artist:"${artist}"`
    : `release:"${input.title}"`

  const url = new URL('https://musicbrainz.org/ws/2/release-group/')
  url.searchParams.set('query', query)
  url.searchParams.set('fmt', 'json')
  url.searchParams.set('limit', '5')

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'longerwords.com/1.0 (https://longerwords.com)' },
    next: { revalidate: 60 * 60 * 24 },
  })
  if (!res.ok) return { cover_url: null, source: null }

  const data = (await res.json()) as MusicBrainzSearch
  for (const group of data['release-groups'] ?? []) {
    if (!group.id) continue

    const coverRes = await fetch(`https://coverartarchive.org/release-group/${group.id}`, {
      headers: { 'User-Agent': 'longerwords.com/1.0 (https://longerwords.com)' },
      next: { revalidate: 60 * 60 * 24 },
    })
    if (!coverRes.ok) continue

    const coverData = (await coverRes.json()) as CoverArtArchiveResponse
    const image = coverData.images?.find(item => item.front) ?? coverData.images?.[0]
    const cover = normalizeImageUrl(image?.thumbnails?.['500'] ?? image?.thumbnails?.large ?? image?.image)
    if (cover) return { cover_url: cover, source: 'cover-art-archive' }
  }

  return { cover_url: null, source: null }
}

async function findCover(input: CoverInput) {
  if (input.kind === 'book') return findBookCover(input)
  const musicBrainz = await findMusicBrainzAlbumCover(input)
  if (musicBrainz.cover_url) return musicBrainz
  return findITunesAlbumCover(input)
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const kind = request.nextUrl.searchParams.get('kind') as Kind | null
  const title = (request.nextUrl.searchParams.get('title') ?? '').trim()
  const subtitle = (request.nextUrl.searchParams.get('subtitle') ?? '').trim() || null
  const external_id = (request.nextUrl.searchParams.get('external_id') ?? '').trim()

  if (kind !== 'book' && kind !== 'album') {
    return NextResponse.json({ error: 'unsupported kind' }, { status: 400 })
  }
  if (!title || !external_id) {
    return NextResponse.json({ error: 'missing title or external_id' }, { status: 400 })
  }

  try {
    return NextResponse.json(await findCover({ kind, title, subtitle, external_id }))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'cover search failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type Kind = 'book' | 'movie' | 'album'

type SetInput = {
  kind: Kind
  position: number
  external_id: string
  title: string
  subtitle: string | null
  cover_url: string | null
}

type LastFmImage = {
  '#text'?: string
  size?: string
}

type LastFmAlbumInfo = {
  album?: {
    image?: LastFmImage[]
  }
}

type OpenLibraryWork = {
  covers?: number[]
}

type OpenLibrarySearch = {
  docs?: {
    cover_i?: number
    isbn?: string[]
  }[]
}

type GoogleBooksSearch = {
  items?: {
    volumeInfo?: {
      imageLinks?: {
        thumbnail?: string
        smallThumbnail?: string
      }
    }
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

function bestLastFmImage(images: LastFmImage[] | undefined) {
  return [...(images ?? [])]
    .reverse()
    .map((image) => image['#text']?.trim())
    .find(Boolean) ?? null
}

function openLibraryCoverUrl(coverId: number | undefined) {
  return coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : null
}

function isbnCoverUrl(isbn: string | undefined) {
  return isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg?default=false` : null
}

function cleanSubtitle(subtitle: string | null) {
  return subtitle?.replace(/\s*\(\d{4}\)\s*$/, '').trim() ?? ''
}

function normalizeGoogleImage(url: string | undefined) {
  return url ? url.replace(/^http:\/\//, 'https://') : null
}

function normalizeITunesArtwork(url: string | undefined) {
  return url?.replace(/100x100bb\.jpg$/, '600x600bb.jpg') ?? null
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

async function findBookCover(input: SetInput) {
  if (input.kind !== 'book' || input.cover_url) return input.cover_url
  const author = cleanSubtitle(input.subtitle)

  try {
    if (input.external_id.startsWith('/works/') || input.external_id.startsWith('/books/')) {
      const res = await fetch(`https://openlibrary.org${input.external_id}.json`, {
        headers: { 'User-Agent': 'longerwords.com (longer)' },
        next: { revalidate: 60 * 60 * 24 },
      })
      if (res.ok) {
        const data = (await res.json()) as OpenLibraryWork
        const cover = openLibraryCoverUrl(data.covers?.[0])
        if (cover) return cover
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
    if (res.ok) {
      const data = (await res.json()) as OpenLibrarySearch
      for (const doc of data.docs ?? []) {
        const cover = openLibraryCoverUrl(doc.cover_i) ?? isbnCoverUrl(doc.isbn?.[0])
        if (cover) return cover
      }
    }

    const googleUrl = new URL('https://www.googleapis.com/books/v1/volumes')
    googleUrl.searchParams.set('q', author ? `intitle:${input.title} inauthor:${author}` : `intitle:${input.title}`)
    googleUrl.searchParams.set('maxResults', '5')
    googleUrl.searchParams.set('printType', 'books')

    const googleRes = await fetch(googleUrl.toString(), {
      headers: { 'User-Agent': 'longerwords.com (longer)' },
      next: { revalidate: 60 * 60 * 24 },
    })
    if (!googleRes.ok) return input.cover_url

    const googleData = (await googleRes.json()) as GoogleBooksSearch
    for (const item of googleData.items ?? []) {
      const links = item.volumeInfo?.imageLinks
      const cover = normalizeGoogleImage(links?.thumbnail ?? links?.smallThumbnail)
      if (cover) return cover
    }

    return input.cover_url
  } catch {
    return input.cover_url
  }
}

async function findITunesAlbumCover(input: SetInput) {
  const artist = cleanSubtitle(input.subtitle)
  const titleNeedle = normalizeLookupText(input.title)
  const artistNeedle = normalizeLookupText(artist)

  const iTunesUrl = new URL('https://itunes.apple.com/search')
  iTunesUrl.searchParams.set('term', [input.title, artist].filter(Boolean).join(' '))
  iTunesUrl.searchParams.set('media', 'music')
  iTunesUrl.searchParams.set('entity', 'album')
  iTunesUrl.searchParams.set('limit', '10')

  try {
    const res = await fetch(iTunesUrl.toString(), {
      headers: { 'User-Agent': 'longerwords.com (longer)' },
      next: { revalidate: 60 * 60 * 24 },
    })
    if (!res.ok) return null

    const data = (await res.json()) as ITunesSearch
    const results = data.results ?? []
    const match = results.find((item) => {
      const itemTitle = normalizeLookupText(item.collectionName)
      const itemArtist = normalizeLookupText(item.artistName)
      return isLooseTextMatch(itemTitle, titleNeedle) && (!artistNeedle || isLooseTextMatch(itemArtist, artistNeedle))
    })
    return normalizeITunesArtwork(match?.artworkUrl100)
  } catch {
    return null
  }
}

async function findMusicBrainzAlbumCover(input: SetInput) {
  const artist = cleanSubtitle(input.subtitle)
  const query = artist
    ? `release:"${input.title}" AND artist:"${artist}"`
    : `release:"${input.title}"`

  const url = new URL('https://musicbrainz.org/ws/2/release-group/')
  url.searchParams.set('query', query)
  url.searchParams.set('fmt', 'json')
  url.searchParams.set('limit', '5')

  try {
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'longerwords.com/1.0 (https://longerwords.com)' },
      next: { revalidate: 60 * 60 * 24 },
    })
    if (!res.ok) return null

    const data = (await res.json()) as MusicBrainzSearch
    for (const group of data['release-groups'] ?? []) {
      if (!group.id) continue
      const coverUrl = `https://coverartarchive.org/release-group/${group.id}/front-500`
      try {
        const coverRes = await fetch(coverUrl, {
          headers: {
            'User-Agent': 'longerwords.com/1.0 (https://longerwords.com)',
            Range: 'bytes=0-0',
          },
          next: { revalidate: 60 * 60 * 24 },
        })
        if (coverRes.ok) return coverRes.url || coverUrl
      } catch {
        return coverUrl
      }
    }
  } catch {
    return null
  }

  return null
}

async function findAlbumCover(input: SetInput) {
  if (input.kind !== 'album' || input.cover_url) return input.cover_url

  const apiKey = process.env.LASTFM_API_KEY

  if (apiKey && input.subtitle) {
    const url = new URL('https://ws.audioscrobbler.com/2.0/')
    url.searchParams.set('method', 'album.getInfo')
    url.searchParams.set('artist', input.subtitle)
    url.searchParams.set('album', input.title)
    url.searchParams.set('api_key', apiKey)
    url.searchParams.set('format', 'json')
    url.searchParams.set('autocorrect', '1')

    try {
      const res = await fetch(url.toString(), {
        headers: { 'User-Agent': 'longerwords.com (longer)' },
        next: { revalidate: 60 * 60 * 24 },
      })
      if (res.ok) {
        const data = (await res.json()) as LastFmAlbumInfo
        const lastFmCover = bestLastFmImage(data.album?.image)
        if (lastFmCover) return lastFmCover
      }
    } catch {}
  }

  return await findITunesAlbumCover(input)
    ?? await findMusicBrainzAlbumCover(input)
    ?? input.cover_url
}

async function findFavoriteCover(input: SetInput) {
  if (input.kind === 'book') return findBookCover(input)
  if (input.kind === 'album') return findAlbumCover(input)
  return input.cover_url
}

export async function setFavorite(input: SetInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'not authenticated' }

  if (input.position < 1 || input.position > 5) {
    return { error: 'position must be between 1 and 5' }
  }
  if (input.kind !== 'book' && input.kind !== 'movie' && input.kind !== 'album') {
    return { error: 'invalid kind' }
  }

  const coverUrl = await findFavoriteCover(input)
  const favorite = {
    user_id:     user.id,
    kind:        input.kind,
    position:    input.position,
    external_id: input.external_id,
    title:       input.title,
    subtitle:    input.subtitle,
    cover_url:   coverUrl,
  }

  const { error } = await supabase
    .from('profile_favorites')
    .upsert(favorite)

  if (error) return { error: error.message }

  const { data: profile } = await supabase
    .from('profiles').select('handle').eq('id', user.id).single()
  if (profile?.handle) revalidatePath(`/u/${profile.handle}`)

  return { success: true, favorite }
}

export async function removeFavorite(kind: Kind, position: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'not authenticated' }

  const { error } = await supabase
    .from('profile_favorites')
    .delete()
    .eq('user_id', user.id)
    .eq('kind', kind)
    .eq('position', position)

  if (error) return { error: error.message }

  const { data: profile } = await supabase
    .from('profiles').select('handle').eq('id', user.id).single()
  if (profile?.handle) revalidatePath(`/u/${profile.handle}`)

  return { success: true }
}

export async function moveFavorite(
  kind: Kind,
  from: number,
  to: number,
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'not authenticated' }

  if (from < 1 || from > 5 || to < 1 || to > 5 || from === to) {
    return { error: 'invalid positions' }
  }

  const { data: rows } = await supabase
    .from('profile_favorites')
    .select('*')
    .eq('user_id', user.id)
    .eq('kind', kind)

  const list = rows ?? []
  const fromRow = list.find(r => r.position === from)
  const toRow   = list.find(r => r.position === to)
  if (!fromRow) return { error: 'nothing to move' }

  const TEMP = 99
  await supabase.from('profile_favorites').update({ position: TEMP })
    .eq('user_id', user.id).eq('kind', kind).eq('position', from)
  if (toRow) {
    await supabase.from('profile_favorites').update({ position: from })
      .eq('user_id', user.id).eq('kind', kind).eq('position', to)
  }
  await supabase.from('profile_favorites').update({ position: to })
    .eq('user_id', user.id).eq('kind', kind).eq('position', TEMP)

  const { data: profile } = await supabase
    .from('profiles').select('handle').eq('id', user.id).single()
  if (profile?.handle) revalidatePath(`/u/${profile.handle}`)

  return { success: true }
}

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EditFavoritesClient from './EditFavoritesClient'

export const metadata = { title: 'Edit favorites · LONGER' }

type Favorite = {
  kind: 'book' | 'movie' | 'album'
  position: number
  external_id: string
  title: string
  subtitle: string | null
  cover_url: string | null
}

export default async function EditFavoritesPage({
  params,
}: {
  params: Promise<{ handle: string }>
}) {
  const { handle } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, handle')
    .eq('handle', handle.toLowerCase())
    .maybeSingle()

  if (!profile)             redirect('/')
  if (profile.id !== user.id) redirect(`/u/${handle}`)

  const { data: favs } = await supabase
    .from('profile_favorites')
    .select('kind, position, external_id, title, subtitle, cover_url')
    .eq('user_id', user.id)
    .order('position', { ascending: true })

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 20px' }}>
      <Link href={`/u/${profile.handle}`} className="link" style={{ fontSize: 13, marginBottom: 18, display: 'inline-block' }}>
        ← back to profile
      </Link>

      <div className="panel">
        <div className="panel-header">
          <span>┌── EDIT FAVORITES ──┐</span>
        </div>
        <div className="panel-body" style={{ padding: 22 }}>
          <p className="muted" style={{ fontSize: 13, margin: '0 0 20px' }}>
            › up to 5 books, 5 movies, and 5 albums. shown on your profile only.
          </p>
          <EditFavoritesClient initial={(favs ?? []) as Favorite[]} />
        </div>
      </div>
    </div>
  )
}

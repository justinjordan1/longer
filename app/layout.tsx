import './globals.css'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from './SignOutButton'

export const metadata = {
  title: 'LONGER',
  description: 'A reading-and-writing room for Georgia Tech students.',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let profile: { handle: string; is_mod: boolean } | null = null
  let openReports = 0

  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('handle, is_mod')
      .eq('id', user.id)
      .maybeSingle()
    profile = data

    if (profile?.is_mod) {
      const { count } = await supabase
        .from('reports')
        .select('*', { count: 'exact', head: true })
        .is('dismissed_at', null)
      openReports = count ?? 0
    }
  }

  return (
    <html lang="en">
      <body>
        {profile && (
          <header style={{ borderBottom: '2px solid var(--ink)' }}>
            <div style={{
              maxWidth: 1280, margin: '0 auto',
              padding: '14px 20px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              gap: 20, flexWrap: 'wrap',
            }}>
              <Link href="/" style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.18em' }}>
                  <span className="accent">▌</span> LONGER
                </div>
              </Link>
              <div style={{ textAlign: 'right', fontSize: 12 }}>
                <div>
                  <span className="muted">user:</span>{' '}
                  <span className="accent">@</span>{profile.handle}
                  {profile.is_mod && (
                    <span className="flag-badge" style={{ marginLeft: 6 }}>mod</span>
                  )}
                </div>
                <div style={{ marginTop: 2, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  {profile.is_mod && (
                    <Link href="/mod" className="link accent" style={{ fontSize: 11.5 }}>
                      [console{openReports > 0 ? ` · ${openReports}` : ''}]
                    </Link>
                  )}
                  <Link href="/guidelines" className="link" style={{ fontSize: 11.5 }}>
                    [guidelines]
                  </Link>
                  <SignOutButton />
                </div>
              </div>
            </div>
            <div className="status-bar">
              <span><span className="muted">[posts ≥ 500 words]</span></span>
              <span><span className="muted">[comments ≥ 40 words]</span></span>
              <span><span className="muted">[1 comment per hour]</span></span>
              <span><span className="muted">[1 post per day]</span></span>
              <span><span className="muted">[review window 5min · editable]</span></span>
            </div>
          </header>
        )}
        {children}
      </body>
    </html>
  )
}

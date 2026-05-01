'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function OnboardingPage() {
  const [handle, setHandle] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isBetaAccount, setIsBetaAccount] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const valid = /^[a-z0-9_]{3,20}$/.test(handle)


  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const email = user?.email?.toLowerCase() ?? ''
      setIsBetaAccount(email.startsWith('beta+') && email.endsWith('@longerwords.com'))
    }
    void checkUser()
  }, [supabase.auth])

  const submit = async () => {
    if (!valid || loading) return
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { error: insertError } = await supabase.from('profiles').insert({
      id: user.id,
      handle,
    })

    if (insertError) {
      if (insertError.code === '23505') {
        setError('that handle is taken. try another.')
      } else {
        setError(insertError.message)
      }
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '60px 20px' }}>
      <div className="panel">
        <div className="panel-header">
          <span>┌── PICK A HANDLE ──┐</span>
        </div>
        <div className="panel-body" style={{ padding: 24 }}>
          <p style={{ margin: '0 0 18px', lineHeight: 1.7 }}>
            <span className="muted">›</span> this is how you&apos;ll appear on LONGER.
          </p>
          <p style={{ margin: '0 0 24px', lineHeight: 1.7 }}>
            <span className="muted">›</span> choose carefully. handles aren&apos;t changeable. 3–20 characters, lowercase letters, numbers, and underscores only.
          </p>


          {isBetaAccount && (
            <p className="accent" style={{ margin: '0 0 18px', lineHeight: 1.7 }}>
              <span className="muted">›</span> beta account detected.
            </p>
          )}

          <div style={{ borderTop: '1px dashed var(--rule)', paddingTop: 22 }}>
            <p className="smallcaps muted" style={{ fontSize: 12, margin: '0 0 8px' }}>handle</p>
            <div className="field" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="accent" style={{ fontSize: 18 }}>@</span>
              <input
                autoFocus
                value={handle}
                onChange={(e) =>
                  setHandle(e.target.value.replace(/[^a-z0-9_]/gi, '').toLowerCase())
                }
                placeholder="your.handle"
                maxLength={20}
                style={{ fontSize: 18 }}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
              />
            </div>

            {error && (
              <p className="accent" style={{ fontSize: 13, marginTop: 12 }}>! {error}</p>
            )}

            <button
              onClick={submit}
              disabled={!valid || loading}
              className="btn"
              style={{ width: '100%', marginTop: 16 }}
            >
              {loading ? 'creating...' : '▸ continue'}
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}

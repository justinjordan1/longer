'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function OnboardingPage() {
  const [handle, setHandle] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const valid = /^[a-z0-9_]{3,20}$/.test(handle)

  const submit = async () => {
    if (!valid || loading) return
    setLoading(true)
    setError('')

    const response = await fetch('/onboarding/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle }),
    })

    if (response.status === 401) {
      router.push('/login')
      return
    }

    const result = await response.json().catch(() => null)

    if (!response.ok) {
      if (result?.code === '23505' || response.status === 409) {
        setError('that handle is taken. try another.')
      } else if (response.status === 403) {
        setError('beta access required. sign in/up again from /beta.')
      } else {
        setError(result?.error ?? 'could not create profile.')
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

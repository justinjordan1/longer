'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const CREDENTIALS: Record<string, { password: string; email: string }> = {
  rowan: { password: 'rowan', email: 'beta+rowan@longerwords.com' },
  kirsten: { password: 'liang', email: 'beta+kirsten@longerwords.com' },
  racecar: { password: 'racecar', email: 'beta+racecar@longerwords.com' },
}

export default function BetaPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const submit = async () => {
    if (loading) return

    const normalized = username.trim().toLowerCase()
    const match = CREDENTIALS[normalized]

    if (!match || match.password !== password) {
      setError('invalid beta credentials')
      return
    }

    setLoading(true)
    setError('')

    const trySignIn = await supabase.auth.signInWithPassword({
      email: match.email,
      password,
    })

    if (trySignIn.error) {
      if (trySignIn.error.message.toLowerCase().includes('email not confirmed')) {
        setError('beta account exists but is not confirmed in Supabase auth yet.')
      } else if (trySignIn.error.message.toLowerCase().includes('invalid login credentials')) {
        setError('beta account has not been created in Supabase auth yet.')
      } else {
        setError(trySignIn.error.message)
      }
      setLoading(false)
      return
    }

    router.push('/onboarding')
    router.refresh()
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <h1 className="text-3xl font-bold mb-2">LONGER BETA</h1>
        <p className="mb-8 text-sm">private beta access (pre-created accounts only)</p>

        <div className="space-y-3">
          <input
            className="w-full border border-black px-4 py-3"
            placeholder="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
          <input
            className="w-full border border-black px-4 py-3"
            placeholder="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            onClick={submit}
            className="w-full border border-black px-4 py-3 hover:bg-black hover:text-white transition"
            disabled={loading}
          >
            {loading ? 'signing in...' : 'continue'}
          </button>
        </div>
      </div>
    </main>
  )
}

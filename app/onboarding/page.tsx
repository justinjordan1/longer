'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function OnboardingPage() {
  const [handle, setHandle] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const valid = /^[a-z0-9_]{3,20}$/.test(handle)

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
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <h1 className="text-2xl font-bold mb-3">Pick your handle</h1>
        <p className="text-sm mb-6">
          This is how you'll appear on LONGER. Choose carefully — handles
          aren't changeable. 3–20 characters, lowercase letters, numbers,
          and underscores only.
        </p>
        <div className="flex items-baseline border-b border-black pb-2 mb-2">
          <span className="text-2xl">@</span>
          <input
            autoFocus
            value={handle}
            onChange={(e) =>
              setHandle(e.target.value.replace(/[^a-z0-9_]/gi, '').toLowerCase())
            }
            placeholder="your.handle"
            maxLength={20}
            className="flex-1 text-2xl bg-transparent outline-none ml-1"
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </div>
        {error && <p className="text-sm text-red-700 mb-3">{error}</p>}
        <button
          onClick={submit}
          disabled={!valid || loading}
          className="w-full border border-black px-4 py-3 mt-4
                     hover:bg-black hover:text-white transition
                     disabled:opacity-30 disabled:hover:bg-transparent
                     disabled:hover:text-black"
        >
          {loading ? 'creating...' : 'continue'}
        </button>
      </div>
    </main>
  )
}

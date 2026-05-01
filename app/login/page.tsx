'use client'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Provider = 'azure' | 'custom:emory'

export default function LoginPage() {
  const supabase = createClient()

  const signIn = async (provider: Provider) => {
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        scopes: 'email openid profile',
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <h1 className="text-3xl font-bold mb-2">LONGER</h1>
        <p className="mb-8 text-sm">
          A place for some longer thoughts I guess. Posts must run at least
          300 words. Comments at least 40.
        </p>
        <div className="space-y-3">
          <button
            onClick={() => signIn('azure')}
            className="w-full border border-black px-4 py-3 hover:bg-black hover:text-white transition"
          >
            Continue with Georgia Tech
          </button>
          <button
            onClick={() => signIn('custom:emory')}
            className="w-full border border-black px-4 py-3 hover:bg-black hover:text-white transition"
          >
            Continue with Emory
          </button>
        </div>
        <p className="text-xs mt-6 opacity-60">
          You&apos;ll be redirected to Microsoft to verify your school identity.{' '}
          <Link href="/guidelines" style={{ textDecoration: 'underline' }}>
            read the guidelines first
          </Link>
          .
        </p>
      </div>
    </main>
  )
}

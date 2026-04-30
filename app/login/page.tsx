'use client'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const supabase = createClient()

  const signIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'azure',
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
          A reading-and-writing room for Georgia Tech students. Posts must run
          at least 500 words. Comments at least 40. Take your time.
        </p>
        <button
          onClick={signIn}
          className="w-full border border-black px-4 py-3 hover:bg-black hover:text-white transition"
        >
          Sign in with Georgia Tech account
        </button>
        <p className="text-xs mt-6 opacity-60">
          You'll be redirected to Microsoft to verify your @gatech.edu identity.
        </p>
      </div>
    </main>
  )
}

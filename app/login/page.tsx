'use client'
import { useMemo, useRef, useState } from 'react'
import Script from 'next/script'
import { createClient } from '@/lib/supabase/client'

type GoogleCredentialResponse = {
  credential?: string
}

type GoogleButtonOptions = {
  type?: 'standard' | 'icon'
  theme?: 'outline' | 'filled_blue' | 'filled_black'
  size?: 'large' | 'medium' | 'small'
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
  shape?: 'rectangular' | 'pill' | 'circle' | 'square'
  logo_alignment?: 'left' | 'center'
  width?: string | number
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (response: GoogleCredentialResponse) => void
            nonce?: string
            use_fedcm_for_prompt?: boolean
          }) => void
          renderButton: (
            parent: HTMLElement,
            options: GoogleButtonOptions
          ) => void
        }
      }
    }
  }
}

async function generateNonce() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const nonce = btoa(String.fromCharCode(...bytes))
  const encodedNonce = new TextEncoder().encode(nonce)
  const hashBuffer = await crypto.subtle.digest('SHA-256', encodedNonce)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashedNonce = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  return { nonce, hashedNonce }
}

export default function LoginPage() {
  const supabase = useMemo(() => createClient(), [])
  const googleButtonRef = useRef<HTMLDivElement>(null)
  const [googleReady, setGoogleReady] = useState(false)
  const [googlePending, setGooglePending] = useState(false)
  const [googleError, setGoogleError] = useState('')
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

  const initializeGoogleButton = async () => {
    if (!googleClientId || !window.google || !googleButtonRef.current || googlePending) return

    setGoogleError('')
    const { nonce, hashedNonce } = await generateNonce()

    window.google.accounts.id.initialize({
      client_id: googleClientId,
      nonce: hashedNonce,
      use_fedcm_for_prompt: true,
      callback: async (response) => {
        if (!response.credential) {
          setGoogleError('Google did not return an auth token. Try again.')
          return
        }

        setGooglePending(true)
        setGoogleError('')

        const { error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: response.credential,
          nonce,
        })

        if (error) {
          setGooglePending(false)
          setGoogleError(error.message)
          return
        }

        window.location.assign('/')
      },
    })

    const buttonWidth = googleButtonRef.current.offsetWidth || 384

    googleButtonRef.current.innerHTML = ''
    window.google.accounts.id.renderButton(googleButtonRef.current, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'rectangular',
      logo_alignment: 'left',
      width: buttonWidth,
    })
  }

  const signInWithGatech = async () => {
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
          A place for some longer thoughts I guess. Posts must run at least
          300 words. Comments at least 40.
        </p>
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
          onLoad={() => {
            setGoogleReady(true)
            void initializeGoogleButton()
          }}
        />
        <div
          ref={(node) => {
            googleButtonRef.current = node
            if (node && googleReady) void initializeGoogleButton()
          }}
          className="w-full min-h-[44px]"
        />
        {!googleClientId && (
          <p className="text-xs mt-2 text-red-700">
            Google sign-in/up needs NEXT_PUBLIC_GOOGLE_CLIENT_ID.
          </p>
        )}
        {googlePending && (
          <p className="text-xs mt-2 opacity-60">Signing you in...</p>
        )}
        {googleError && (
          <p className="text-xs mt-2 text-red-700">{googleError}</p>
        )}
        <button
          onClick={signInWithGatech}
          className="w-full border border-black px-4 py-3 mt-3 hover:bg-black hover:text-white transition"
        >
          Sign in/up with GT account
        </button>
        <p className="text-xs mt-6 opacity-60">
          You can use any Google account. GT sign-in/up still works for
          existing campus users.
        </p>
      </div>
    </main>
  )
}

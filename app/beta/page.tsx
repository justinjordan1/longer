import { redirect } from 'next/navigation'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const CREDENTIALS: Record<string, { password: string; email: string }> = {
  rowan: { password: 'rowan', email: 'beta+rowan@longerwords.com' },
  kirsten: { password: 'liang', email: 'beta+kirsten@longerwords.com' },
  racecar: { password: 'racecar', email: 'beta+racecar@longerwords.com' },
}

async function betaLogin(formData: FormData) {
  'use server'

  const username = String(formData.get('username') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')
  const match = CREDENTIALS[username]

  if (!match || match.password !== password) {
    redirect('/beta?error=invalid')
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRole) {
    redirect('/beta?error=missing-server-config')
  }

  const admin = createAdminClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const list = await admin.auth.admin.listUsers()
  if (list.error) {
    redirect('/beta?error=admin-list-failed')
  }

  const existing = list.data.users.find((u) => u.email?.toLowerCase() === match.email)

  if (!existing) {
    const created = await admin.auth.admin.createUser({
      email: match.email,
      password,
      email_confirm: true,
    })

    if (created.error) {
      redirect('/beta?error=admin-create-failed')
    }
  } else if (!existing.email_confirmed_at) {
    const updated = await admin.auth.admin.updateUserById(existing.id, {
      email_confirm: true,
      password,
    })

    if (updated.error) {
      redirect('/beta?error=admin-confirm-failed')
    }
  }

  const supabase = await createServerSupabase()
  const signedIn = await supabase.auth.signInWithPassword({
    email: match.email,
    password,
  })

  if (signedIn.error) {
    redirect('/beta?error=signin-failed')
  }

  redirect('/onboarding')
}

function errorMessage(code?: string) {
  switch (code) {
    case 'invalid':
      return 'invalid beta credentials'
    case 'missing-server-config':
      return 'missing server config: SUPABASE_SERVICE_ROLE_KEY'
    case 'admin-list-failed':
      return 'unable to read beta users from Supabase'
    case 'admin-create-failed':
      return 'unable to create beta account in Supabase'
    case 'admin-confirm-failed':
      return 'unable to confirm beta account in Supabase'
    case 'signin-failed':
      return 'beta account exists but sign-in failed'
    default:
      return ''
  }
}

export default async function BetaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  const message = errorMessage(params.error)

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <h1 className="text-3xl font-bold mb-2">LONGER BETA</h1>
        <p className="mb-8 text-sm">private beta access</p>

        <form action={betaLogin} className="space-y-3">
          <input className="w-full border border-black px-4 py-3" placeholder="username" name="username" />
          <input
            className="w-full border border-black px-4 py-3"
            placeholder="password"
            name="password"
            type="password"
          />
          {message && <p className="text-sm text-red-600">{message}</p>}
          <button className="w-full border border-black px-4 py-3 hover:bg-black hover:text-white transition">
            continue
          </button>
        </form>
      </div>
    </main>
  )
}

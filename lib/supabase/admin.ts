import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Service-role client: bypasses RLS, so it must never be imported into a
// client component or handed a user-supplied filter without checking it first.
// Used to read the address auth.users holds for a letter's recipient, which
// no anon/authenticated grant exposes.
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null

  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

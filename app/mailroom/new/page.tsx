import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ComposeLetterForm from './ComposeLetterForm'

export default async function NewLetterPage({
  searchParams,
}: {
  searchParams: Promise<{ to?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/mailroom/new')

  return <ComposeLetterForm initialRecipient={(params.to || '').trim().replace(/^@/, '')} />
}

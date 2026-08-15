'use server'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyUnsubscribeToken } from '@/lib/unsubscribe'

export async function unsubscribeFromLetterEmails(formData: FormData) {
  const token = String(formData.get('t') || '')
  const userId = verifyUnsubscribeToken(token)
  if (!userId) redirect('/unsubscribe?error=invalid')

  const admin = createAdminClient()
  if (!admin) redirect(`/unsubscribe?t=${encodeURIComponent(token)}&error=unavailable`)

  const { error } = await admin
    .from('profiles')
    .update({ letter_email_notifications: false })
    .eq('id', userId)

  if (error) redirect(`/unsubscribe?t=${encodeURIComponent(token)}&error=failed`)

  redirect(`/unsubscribe?t=${encodeURIComponent(token)}&done=1`)
}

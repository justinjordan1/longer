'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function dismissFavoritesPrompt() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'not authenticated' }

  const { error } = await supabase.rpc('dismiss_favorites_prompt')

  if (error) return { error: error.message }

  revalidatePath('/')
  return { success: true }
}

export async function dismissIntroBanner() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'not authenticated' }

  const { error } = await supabase.rpc('dismiss_intro_banner')

  if (error) return { error: error.message }

  revalidatePath('/')
  return { success: true }
}

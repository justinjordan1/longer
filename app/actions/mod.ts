'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function modRemovePost(postId: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('mod_remove_post', { p_post_id: postId })
  if (error) return { error: error.message }
  revalidatePath('/')
  revalidatePath(`/post/${postId}`)
  revalidatePath('/mod')
  return { success: true }
}

export async function modRestorePost(postId: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('mod_restore_post', { p_post_id: postId })
  if (error) return { error: error.message }
  revalidatePath('/')
  revalidatePath(`/post/${postId}`)
  revalidatePath('/mod')
  return { success: true }
}

export async function modSetFlag(postId: string, flag: string | null) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('mod_set_flag', {
    p_post_id: postId,
    p_flag: flag,
  })
  if (error) return { error: error.message }
  revalidatePath('/')
  revalidatePath(`/post/${postId}`)
  revalidatePath('/mod')
  return { success: true }
}

export async function modDismissReports(
  postId: string,
  kind: 'hateful' | 'ai',
) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('mod_dismiss_reports', {
    p_post_id: postId,
    p_kind: kind,
  })
  if (error) return { error: error.message }
  revalidatePath('/mod')
  revalidatePath(`/post/${postId}`)
  return { success: true }
}

'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// mod authorization is enforced inside each SECURITY DEFINER RPC

async function callModRpc(
  fn: string,
  args: Record<string, unknown>,
  revalidate: string[],
) {
  const supabase = await createClient()
  const { error } = await supabase.rpc(fn, args)
  if (error) return { error: error.message }
  for (const path of revalidate) revalidatePath(path)
  return { success: true }
}

export async function modRemovePost(postId: string) {
  return callModRpc('mod_remove_post', { p_post_id: postId }, ['/', `/post/${postId}`, '/mod'])
}

export async function modRestorePost(postId: string) {
  return callModRpc('mod_restore_post', { p_post_id: postId }, ['/', `/post/${postId}`, '/mod'])
}

export async function modSetFlag(postId: string, flag: string | null) {
  return callModRpc('mod_set_flag', { p_post_id: postId, p_flag: flag }, ['/', `/post/${postId}`, '/mod'])
}

export async function modDismissReports(postId: string, kind: 'hateful' | 'ai') {
  return callModRpc('mod_dismiss_reports', { p_post_id: postId, p_kind: kind }, ['/mod', `/post/${postId}`])
}

export async function modDismissLetterReports(letterId: string) {
  return callModRpc('mod_dismiss_letter_reports', { p_letter_id: letterId }, ['/mod'])
}

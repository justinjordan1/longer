'use client'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { modDismissReports, modRemovePost, modRestorePost } from '@/app/actions/mod'

type Props =
  | { postId: string; action: 'dismiss'; kind: 'hateful' | 'ai' }
  | { postId: string; action: 'remove' }
  | { postId: string; action: 'restore' }

export default function ModRowActions(props: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const handle = () => {
    startTransition(async () => {
      if (props.action === 'dismiss') await modDismissReports(props.postId, props.kind)
      else if (props.action === 'remove') await modRemovePost(props.postId)
      else await modRestorePost(props.postId)
      router.refresh()
    })
  }

  const label =
    props.action === 'dismiss' ? 'dismiss' :
    props.action === 'remove'  ? '[remove]' :
                                 '[restore]'

  const cls = props.action === 'remove' ? 'link accent' : 'link'

  return (
    <button onClick={handle} disabled={pending} className={cls} style={{ fontSize: 12 }}>
      {pending ? '...' : label}
    </button>
  )
}

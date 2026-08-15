'use client'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  modDismissLetterReports,
  modDismissReports,
  modRemovePost,
  modRestorePost,
} from '@/app/actions/mod'

type Props =
  | { postId: string; action: 'dismiss'; kind: 'hateful' | 'ai' }
  | { postId: string; action: 'remove' }
  | { postId: string; action: 'restore' }
  | { letterId: string; action: 'dismiss-letter-reports' }

function run(props: Props) {
  switch (props.action) {
    case 'dismiss':                return modDismissReports(props.postId, props.kind)
    case 'remove':                 return modRemovePost(props.postId)
    case 'restore':                return modRestorePost(props.postId)
    case 'dismiss-letter-reports': return modDismissLetterReports(props.letterId)
  }
}

const LABELS: Record<Props['action'], string> = {
  'dismiss':                'dismiss',
  'remove':                 '[remove]',
  'restore':                '[restore]',
  'dismiss-letter-reports': '[dismiss reports]',
}

export default function ModRowActions(props: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const handle = () => {
    startTransition(async () => {
      await run(props)
      router.refresh()
    })
  }

  const cls = props.action === 'remove' ? 'link accent' : 'link'

  return (
    <button onClick={handle} disabled={pending} className={cls} style={{ fontSize: 12 }}>
      {pending ? '...' : LABELS[props.action]}
    </button>
  )
}

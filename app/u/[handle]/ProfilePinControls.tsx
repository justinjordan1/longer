'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { setProfilePostPin } from '@/app/actions/posts'

export default function ProfilePinControls({
  postId,
  currentPosition,
}: {
  postId: string
  currentPosition: number | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const positions = [1, 2, 3].filter(position => position !== currentPosition)

  const setPin = (position: number | null) => {
    if (pending) return
    startTransition(async () => {
      const res = await setProfilePostPin(postId, position)
      if (!res?.error) router.refresh()
    })
  }

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'baseline', marginTop: 8 }}>
      <span className="muted" style={{ fontSize: 11.5 }}>pin at position</span>
      {positions.map(position => (
        <button
          key={position}
          className="link muted"
          disabled={pending}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            setPin(position)
          }}
          style={{ fontSize: 11.5 }}
        >
          [{position}]
        </button>
      ))}
      {currentPosition && (
        <>
          <span className="muted" style={{ fontSize: 11.5 }}>·</span>
          <button
            className="link muted"
            disabled={pending}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              setPin(null)
            }}
            style={{ fontSize: 11.5 }}
          >
            unpin
          </button>
        </>
      )}
    </div>
  )
}

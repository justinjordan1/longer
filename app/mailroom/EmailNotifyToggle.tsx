'use client'
import { useState, useTransition } from 'react'
import { setLetterEmailNotifications } from '@/app/actions/letters'

export default function EmailNotifyToggle({ enabled }: { enabled: boolean }) {
  const [on, setOn] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const toggle = () => {
    if (pending) return
    const next = !on
    setOn(next)
    setError(null)
    startTransition(async () => {
      const res = await setLetterEmailNotifications(next)
      if (res?.error) {
        setOn(!next)
        setError(res.error)
      }
    })
  }

  return (
    <div style={{ marginTop: 10 }}>
      <button
        type="button"
        className="link"
        onClick={toggle}
        disabled={pending}
        style={{ fontSize: 12 }}
      >
        email me when a letter arrives:{' '}
        <span className={on ? 'positive' : 'muted'} style={{ fontWeight: 700 }}>
          {on ? '[x] on' : '[ ] off'}
        </span>
      </button>
      {error && (
        <div className="accent" style={{ fontSize: 11.5, marginTop: 4 }}>
          couldn&apos;t save that: {error}
        </div>
      )}
    </div>
  )
}

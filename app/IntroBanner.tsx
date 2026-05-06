'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { dismissIntroBanner } from './actions/profile'

export default function IntroBanner({ canDismiss }: { canDismiss: boolean }) {
  const [hidden, setHidden] = useState(false)
  const [pending, startTransition] = useTransition()

  if (hidden) return null

  const dismiss = () => {
    if (!canDismiss) return

    startTransition(async () => {
      await dismissIntroBanner()
      setHidden(true)
    })
  }

  return (
    <div
      style={{
        background: 'var(--paper)',
        border: '1px solid var(--ink)',
        boxShadow: '8px 8px 0 var(--ink)',
        marginBottom: 28,
      }}
    >
      <div className="panel-header" style={{ background: 'var(--paper-3)' }}>
        <span>┌── ABOUT ──┐</span>
        {canDismiss ? (
          <button
            className="link"
            onClick={dismiss}
            disabled={pending}
            style={{ fontSize: 12, color: 'var(--ink)' }}
          >
            [x] don&apos;t show again
          </button>
        ) : null}
      </div>
      <div style={{ padding: 16 }}>
        <p style={{ margin: '0 0 12px', lineHeight: 1.6 }}>
          <strong>write whatever</strong>. short stories, essays, poems, book reviews,
          rants about life, rants about a theoretical life, plans, failures, or whatever
          else is on the dome. <Link href="/guidelines" className="link">[guidelines]</Link>.
        </p>
        <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
          click on handles to see personal profiles. scroll to the bottom of posts to vote
          or reply.
        </p>
      </div>
    </div>
  )
}

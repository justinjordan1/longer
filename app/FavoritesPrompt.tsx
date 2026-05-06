'use client'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { dismissFavoritesPrompt } from './actions/profile'

export default function FavoritesPrompt({ handle }: { handle: string }) {
  const [hidden, setHidden] = useState(false)
  const [pending, startTransition] = useTransition()

  if (hidden) return null

  const dismiss = () => {
    startTransition(async () => {
      await dismissFavoritesPrompt()
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
        <span>┌── PROFILE PROMPT ──┐</span>
        <button
          className="link"
          onClick={dismiss}
          disabled={pending}
          style={{ fontSize: 12, color: 'var(--ink)' }}
        >
          [x] don&apos;t show again
        </button>
      </div>
      <div style={{ padding: 16 }}>
        <p style={{ margin: '0 0 14px', lineHeight: 1.55 }}>
          Add your favorite books and movies to your profile.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" onClick={() => setHidden(true)}>
            Skip
          </button>
          <Link href={`/u/${handle}/edit`} className="btn">
            Update profile
          </Link>
        </div>
      </div>
    </div>
  )
}

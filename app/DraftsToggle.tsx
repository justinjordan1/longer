'use client'
import { useState } from 'react'
import Link from 'next/link'
import { timeAgo } from '@/lib/longer'

export type DraftStub = {
  id: string
  title: string
  body: string
  word_count: number
  updated_at: string
}

export default function DraftsToggle({ drafts, unreadLetters = 0 }: { drafts: DraftStub[]; unreadLetters?: number }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <pre className="ascii muted" style={{ fontSize: 13 }}>
{`┌─[ FRONT PAGE ]─────────────────`}
        </pre>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {drafts.length > 0 && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setOpen((current) => !current)}
            >
              {open ? 'Hide Drafts' : `Drafts · ${drafts.length}`}
            </button>
          )}
          <Link href="/mailroom" className="btn btn-ghost">
            ▸ MAILROOM
            {unreadLetters > 0 && (
              <span style={{
                marginLeft: 8,
                display: 'inline-block',
                background: 'var(--accent)', color: 'var(--paper)',
                padding: '0 6px', fontSize: 11, fontWeight: 700,
                letterSpacing: '0.04em',
              }}>
                {unreadLetters}
              </span>
            )}
          </Link>
          <Link href="/compose" className="btn">▸ NEW</Link>
        </div>
      </div>

      {open && drafts.length > 0 && (
        <div id="drafts" className="panel" style={{ marginBottom: 24 }}>
          <div className="panel-header">
            <span>DRAFTS</span>
            <span className="muted">{drafts.length}</span>
          </div>
          <div>
            {drafts.map((draft, i) => (
              <Link key={draft.id} href={`/compose?draft=${draft.id}`} className="post-row">
                <div className="muted" style={{ fontSize: 12 }}>
                  {String(i + 1).padStart(3, '0')} ▸ saved {timeAgo(draft.updated_at)}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35, margin: '2px 0 4px' }}>
                  {draft.title || '[untitled draft]'}
                </div>
                <div className="muted" style={{ fontSize: 11.5 }}>
                  {draft.word_count} wd · {(draft.body || 'empty draft').slice(0, 120)}
                  {draft.body.length > 120 ? '...' : ''}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

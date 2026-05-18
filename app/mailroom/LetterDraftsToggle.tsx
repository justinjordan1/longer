'use client'
import { useState } from 'react'
import Link from 'next/link'
import { timeAgo } from '@/lib/longer'

export type LetterDraftStub = {
  id: string
  recipient_handle: string
  title: string
  body: string
  word_count: number
  updated_at: string
}

export default function LetterDraftsToggle({ drafts }: { drafts: LetterDraftStub[] }) {
  const [open, setOpen] = useState(false)

  if (drafts.length === 0) return null

  return (
    <div style={{ marginBottom: 20 }}>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => setOpen(o => !o)}
      >
        {open ? 'Hide Drafts' : `Drafts · ${drafts.length}`}
      </button>

      {open && (
        <div className="panel" style={{ marginTop: 10 }}>
          <div className="panel-header">
            <span>LETTER DRAFTS</span>
            <span className="muted">{drafts.length}</span>
          </div>
          <div>
            {drafts.map((draft, i) => (
              <Link key={draft.id} href={`/mailroom/new?draft=${draft.id}`} className="post-row">
                <div className="muted" style={{ fontSize: 12 }}>
                  {String(i + 1).padStart(3, '0')} ▸ saved {timeAgo(draft.updated_at)}
                  {draft.recipient_handle && (
                    <> · to <span className="accent">@</span>{draft.recipient_handle}</>
                  )}
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
    </div>
  )
}

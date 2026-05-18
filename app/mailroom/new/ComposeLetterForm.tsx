'use client'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { countWords } from '@/lib/longer'
import { sendLetter } from '@/app/actions/letters'

export default function ComposeLetterForm({ initialRecipient }: { initialRecipient: string }) {
  const [recipient, setRecipient] = useState(initialRecipient)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  const words = countWords(body)
  const canSend = recipient.trim().length > 0 && body.trim().length > 0

  const onSubmit = () => {
    if (!canSend || pending) return
    setError('')
    startTransition(async () => {
      const fd = new FormData()
      fd.set('recipient', recipient.trim())
      fd.set('title', title.trim())
      fd.set('body', body.trim())
      const res = await sendLetter(fd)
      if (res?.error) setError(res.error)
    })
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 20px' }}>
      <Link href="/mailroom" className="link" style={{ fontSize: 13, marginBottom: 18, display: 'inline-block' }}>
        ← back to mailroom
      </Link>

      <div className="panel">
        <div className="panel-header">
          <span>┌── NEW LETTER ──┐</span>
          <span className="muted">private</span>
        </div>
        <div className="panel-body" style={{ padding: 20 }}>
          <p className="smallcaps muted" style={{ fontSize: 11.5, margin: '0 0 6px' }}>to</p>
          <div className="field" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="accent" style={{ fontWeight: 600 }}>@</span>
            <input
              autoFocus={!initialRecipient}
              value={recipient}
              onChange={(e) => setRecipient(e.target.value.replace(/^@/, ''))}
              placeholder="recipient handle"
              maxLength={64}
              style={{ fontSize: 16, fontWeight: 600 }}
            />
          </div>

          <p className="smallcaps muted" style={{ fontSize: 11.5, margin: '0 0 6px' }}>title</p>
          <div className="field" style={{ marginBottom: 16 }}>
            <input
              autoFocus={Boolean(initialRecipient)}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="optional title for your letter."
              maxLength={200}
              style={{ fontSize: 18, fontWeight: 600 }}
            />
          </div>

          <p className="smallcaps muted" style={{ fontSize: 11.5, margin: '0 0 6px' }}>body</p>
          <div className="field" style={{ marginBottom: 16 }}>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="write your letter. no minimum, no maximum, just say it."
              rows={14}
              style={{ resize: 'vertical', minHeight: 240, lineHeight: 1.6 }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <span className="muted" style={{ fontSize: 12 }}>word count</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{words}</span>
          </div>

          <div className="scheduled" style={{ marginBottom: 18 }}>
            <div className="smallcaps muted" style={{ fontSize: 11.5, marginBottom: 4 }}>delivery</div>
            <div style={{ fontSize: 13 }}>
              letters go straight to the recipient&apos;s mailroom. they can read, report, or block you. max 3 letters per day to the same person.
            </div>
          </div>

          {error && (
            <p className="accent" style={{ fontSize: 13, marginBottom: 12 }}>! {error}</p>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <Link href="/mailroom" className="btn btn-ghost">Cancel</Link>
            <button
              type="button"
              className="btn"
              disabled={!canSend || pending}
              onClick={onSubmit}
            >
              {pending ? 'sending...' : '▸ Send Letter'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

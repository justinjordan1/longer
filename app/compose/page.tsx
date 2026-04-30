'use client'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { POST_MIN_WORDS, countWords } from '@/lib/longer'
import { createPost } from '@/app/actions/posts'

export default function ComposePage() {
  const [title, setTitle] = useState('')
  const [body, setBody]   = useState('')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  const words = countWords(body)
  const meets = words >= POST_MIN_WORDS
  const ready = meets && title.trim().length > 0
  const pct = Math.min(100, (words / POST_MIN_WORDS) * 100)

  const onSubmit = () => {
    if (!ready || pending) return
    setError('')
    const fd = new FormData()
    fd.set('title', title.trim())
    fd.set('body', body.trim())
    startTransition(async () => {
      const res = await createPost(fd)
      // createPost redirects on success, so we only get back here on error
      if (res?.error) setError(res.error)
    })
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 20px' }}>
      <Link href="/" className="link" style={{ fontSize: 13, marginBottom: 18, display: 'inline-block' }}>
        ← back to front page
      </Link>

      <div className="panel">
        <div className="panel-header">
          <span>┌── NEW ESSAY ──┐</span>
        </div>
        <div className="panel-body" style={{ padding: 20 }}>
          <p className="smallcaps muted" style={{ fontSize: 11.5, margin: '0 0 6px' }}>title</p>
          <div className="field" style={{ marginBottom: 16 }}>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="give your essay a title."
              maxLength={200}
              style={{ fontSize: 18, fontWeight: 600 }}
            />
          </div>

          <p className="smallcaps muted" style={{ fontSize: 11.5, margin: '0 0 6px' }}>body</p>
          <div className="field" style={{ marginBottom: 16 }}>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={`write something worth reading. minimum ${POST_MIN_WORDS} words. take your time.`}
              style={{ minHeight: 360, resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <span className="muted" style={{ fontSize: 12 }}>word count</span>
            <span style={{ fontVariantNumeric: 'tabular-nums', color: meets ? 'var(--positive)' : 'var(--ink-soft)' }}>
              {words} <span className="muted">/ {POST_MIN_WORDS}</span>
            </span>
          </div>
          <div className="progress-track" style={{ marginBottom: 18 }}>
            <div className={`progress-fill ${meets ? 'ok' : ''}`} style={{ width: `${pct}%` }} />
          </div>

          <div className="scheduled" style={{ marginBottom: 18 }}>
            <div className="smallcaps muted" style={{ fontSize: 11.5, marginBottom: 4 }}>cooling-off period</div>
            <div style={{ fontSize: 13 }}>
              once submitted, your essay enters review for 15 minutes before appearing.
              you cannot edit or recall it during review. one post per 24 hours.
            </div>
          </div>

          {error && (
            <p className="accent" style={{ fontSize: 13, marginBottom: 12 }}>! {error}</p>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Link href="/" className="btn btn-ghost">Discard</Link>
            <button
              className="btn"
              disabled={!ready || pending}
              onClick={onSubmit}
            >
              {pending
                ? 'submitting...'
                : meets
                  ? '▸ Submit for Review'
                  : `${POST_MIN_WORDS - words} more words needed`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { POST_MIN_WORDS, countWords, timeUntil } from '@/lib/longer'
import {
  createPost,
  updateScheduledPost,
  discardScheduledPost,
} from '@/app/actions/posts'

type Props =
  | { mode: 'new' }
  | {
      mode: 'edit'
      postId: string
      initialTitle: string
      initialBody: string
      publishAt: string
    }

export default function ComposeForm(props: Props) {
  const isEdit = props.mode === 'edit'
  const router = useRouter()

  const [title, setTitle] = useState(isEdit ? props.initialTitle : '')
  const [body,  setBody]  = useState(isEdit ? props.initialBody  : '')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)

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
      const res = isEdit
        ? await updateScheduledPost(props.postId, fd)
        : await createPost(fd)
      if (res?.error) setError(res.error)
    })
  }

  const onDiscard = () => {
    if (!isEdit || pending) return
    startTransition(async () => {
      const res = await discardScheduledPost(props.postId)
      if (res?.error) {
        setError(res.error)
        setConfirmingDiscard(false)
      } else {
        router.push('/')
        router.refresh()
      }
    })
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 20px' }}>
      <Link href="/" className="link" style={{ fontSize: 13, marginBottom: 18, display: 'inline-block' }}>
        ← back to front page
      </Link>

      <div className="panel">
        <div className="panel-header">
          <span>{isEdit ? '┌── EDIT DRAFT ──┐' : '┌── NEW ESSAY ──┐'}</span>
          {isEdit && (
            <span className="muted">
              publishes in {timeUntil(props.publishAt)}
            </span>
          )}
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
            <div className="smallcaps muted" style={{ fontSize: 11.5, marginBottom: 4 }}>
              {isEdit ? 'review window' : 'cooling-off period'}
            </div>
            <div style={{ fontSize: 13 }}>
              {isEdit
                ? <>your essay publishes in {timeUntil(props.publishAt)}. you can keep editing until then. once published, the post is locked.</>
                : <>once submitted, your essay enters review for 5 minutes. you can edit or discard during that window. one post per 24 hours.</>}
            </div>
          </div>

          {error && (
            <p className="accent" style={{ fontSize: 13, marginBottom: 12 }}>! {error}</p>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div>
              {isEdit && !confirmingDiscard && (
                <button
                  className="btn btn-ghost"
                  style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
                  onClick={() => setConfirmingDiscard(true)}
                  disabled={pending}
                >
                  ▸ discard draft
                </button>
              )}
              {isEdit && confirmingDiscard && (
                <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                  <span>discard for real?</span>
                  <button
                    className="btn"
                    style={{ background: 'var(--accent)', borderColor: 'var(--accent)' }}
                    onClick={onDiscard}
                    disabled={pending}
                  >
                    yes, discard
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={() => setConfirmingDiscard(false)}
                    disabled={pending}
                  >
                    cancel
                  </button>
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <Link href="/" className="btn btn-ghost">{isEdit ? 'Back' : 'Discard'}</Link>
              <button
                className="btn"
                disabled={!ready || pending}
                onClick={onSubmit}
              >
                {pending
                  ? (isEdit ? 'saving...' : 'submitting...')
                  : meets
                    ? (isEdit ? '▸ save changes' : '▸ Submit for Review')
                    : `${POST_MIN_WORDS - words} more words needed`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

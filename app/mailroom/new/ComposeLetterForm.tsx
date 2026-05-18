'use client'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LETTER_MIN_WORDS, countWords, timeAgo } from '@/lib/longer'
import {
  sendLetter,
  saveLetterDraft,
  discardLetterDraft,
} from '@/app/actions/letters'

export type ReplyContext = {
  id: string
  title: string
  body: string
  createdAt: string
  wordCount: number
  fromHandle: string
}

type Props = {
  initialRecipient: string
  initialTitle: string
  initialBody: string
  draftId: string | null
  reply: ReplyContext | null
}

export default function ComposeLetterForm({
  initialRecipient,
  initialTitle,
  initialBody,
  draftId: initialDraftId,
  reply,
}: Props) {
  const router = useRouter()

  const [draftId,   setDraftId]   = useState<string | null>(initialDraftId)
  const [recipient, setRecipient] = useState(initialRecipient)
  const [title,     setTitle]     = useState(initialTitle)
  const [body,      setBody]      = useState(initialBody)
  const [error,     setError]     = useState('')
  const [savedMessage, setSavedMessage] = useState('')
  const [pending, startTransition] = useTransition()
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)

  const words = countWords(body)
  const meets = words >= LETTER_MIN_WORDS
  const ready = meets && recipient.trim().length > 0
  const canSaveDraft =
    recipient.trim().length > 0 || title.trim().length > 0 || body.trim().length > 0
  const pct = Math.min(100, (words / LETTER_MIN_WORDS) * 100)

  const buildFormData = () => {
    const fd = new FormData()
    fd.set('recipient', recipient.trim())
    fd.set('title',     title.trim())
    fd.set('body',      body.trim())
    if (reply) fd.set('reply_to', reply.id)
    if (draftId) fd.set('draft_id', draftId)
    return fd
  }

  const onSubmit = () => {
    if (!ready || pending) return
    setError('')
    startTransition(async () => {
      const res = await sendLetter(buildFormData())
      if (res?.error) setError(res.error)
    })
  }

  const onSaveDraft = () => {
    if (!canSaveDraft || pending) return
    setError('')
    setSavedMessage('')
    startTransition(async () => {
      const res = await saveLetterDraft(draftId, buildFormData())
      if (res?.error) { setError(res.error); return }
      if (res?.draftId) setDraftId(res.draftId)
      setSavedMessage('draft saved.')
      if (!draftId && res?.draftId) {
        router.replace(`/mailroom/new?draft=${res.draftId}`)
      }
      router.refresh()
    })
  }

  const onSaveAndExit = () => {
    if (pending) return
    if (!canSaveDraft) {
      router.push('/mailroom')
      return
    }
    setError('')
    startTransition(async () => {
      const res = await saveLetterDraft(draftId, buildFormData())
      if (res?.error) { setError(res.error); return }
      router.push('/mailroom')
      router.refresh()
    })
  }

  const onDiscard = () => {
    if (pending) return
    startTransition(async () => {
      if (draftId) {
        const res = await discardLetterDraft(draftId)
        if (res?.error) { setError(res.error); setConfirmingDiscard(false); return }
      }
      router.push('/mailroom')
      router.refresh()
    })
  }

  const composer = (
    <div className="panel">
      <div className="panel-header">
        <span>{reply ? '┌── REPLY ──┐' : initialDraftId ? '┌── DRAFT ──┐' : '┌── NEW LETTER ──┐'}</span>
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
            disabled={Boolean(reply)}
            style={{ fontSize: 16, fontWeight: 600 }}
          />
        </div>

        <p className="smallcaps muted" style={{ fontSize: 11.5, margin: '0 0 6px' }}>title</p>
        <div className="field" style={{ marginBottom: 16 }}>
          <input
            autoFocus={Boolean(initialRecipient) && !initialTitle && !reply}
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
            autoFocus={Boolean(reply)}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={`write your letter. minimum ${LETTER_MIN_WORDS} words.`}
            rows={14}
            style={{ resize: 'vertical', minHeight: 240, lineHeight: 1.6 }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          <span className="muted" style={{ fontSize: 12 }}>word count</span>
          <span style={{ fontVariantNumeric: 'tabular-nums', color: meets ? 'var(--positive)' : 'var(--ink-soft)' }}>
            {words} <span className="muted">/ {LETTER_MIN_WORDS}</span>
          </span>
        </div>
        <div className="progress-track" style={{ marginBottom: 18 }}>
          <div className={`progress-fill ${meets ? 'ok' : ''}`} style={{ width: `${pct}%` }} />
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
        {savedMessage && (
          <p className="positive" style={{ fontSize: 13, marginBottom: 12 }}>✓ {savedMessage}</p>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div>
            {!confirmingDiscard && draftId && (
              <button
                type="button"
                className="btn btn-ghost"
                style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
                onClick={() => setConfirmingDiscard(true)}
                disabled={pending}
              >
                ▸ discard draft
              </button>
            )}
            {confirmingDiscard && (
              <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                <span>discard for real?</span>
                <button
                  type="button"
                  className="btn"
                  style={{ background: 'var(--accent)', borderColor: 'var(--accent)' }}
                  onClick={onDiscard}
                  disabled={pending}
                >
                  yes, discard
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setConfirmingDiscard(false)}
                  disabled={pending}
                >
                  cancel
                </button>
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={pending}
              onClick={onSaveAndExit}
            >
              {pending ? 'saving...' : 'Save & Exit'}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={!canSaveDraft || pending}
              onClick={onSaveDraft}
            >
              {pending ? 'saving...' : 'Save Draft'}
            </button>
            <button
              type="button"
              className="btn"
              disabled={!ready || pending}
              onClick={onSubmit}
            >
              {pending
                ? 'sending...'
                : meets
                  ? '▸ Send Letter'
                  : `${LETTER_MIN_WORDS - words} more words needed`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  if (!reply) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 20px' }}>
        <Link href="/mailroom" className="link" style={{ fontSize: 13, marginBottom: 18, display: 'inline-block' }}>
          ← back to mailroom
        </Link>
        {composer}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 20px' }}>
      <Link href="/mailroom" className="link" style={{ fontSize: 13, marginBottom: 18, display: 'inline-block' }}>
        ← back to mailroom
      </Link>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
          gap: 18,
          alignItems: 'start',
        }}
      >
        <OriginalLetter reply={reply} />
        {composer}
      </div>
    </div>
  )
}

function OriginalLetter({ reply }: { reply: ReplyContext }) {
  return (
    <div className="panel" style={{ position: 'sticky', top: 20 }}>
      <div className="panel-header">
        <span>┌── FROM @{reply.fromHandle} ──┐</span>
        <span className="muted">{timeAgo(reply.createdAt)}</span>
      </div>
      <div className="panel-body" style={{ padding: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 10px', lineHeight: 1.3 }}>
          {reply.title || <span className="muted">[untitled letter]</span>}
        </h2>
        <div className="muted" style={{ fontSize: 11.5, marginBottom: 12 }}>
          {reply.wordCount} wd
        </div>
        <div
          className="essay-prose"
          style={{ whiteSpace: 'pre-wrap', fontSize: 13.5, lineHeight: 1.65, maxHeight: 520, overflow: 'auto' }}
        >
          {reply.body}
        </div>
      </div>
    </div>
  )
}

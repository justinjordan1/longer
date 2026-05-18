'use client'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { timeAgo } from '@/lib/longer'
import EnvelopeOpen from './EnvelopeOpen'
import { markLetterRead, deleteLetterFromInbox, reportLetter, blockSender } from '@/app/actions/letters'

export type LetterStub = {
  id: string
  title: string
  body: string
  word_count: number
  created_at: string
  read_at: string | null
  direction: 'incoming' | 'outgoing'
  other_handle: string
  other_id: string
}

export default function InboxList({
  letters,
  box,
}: {
  letters: LetterStub[]
  box: 'inbox' | 'sent'
}) {
  const router = useRouter()
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [readyId, setReadyId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const opening = openingId ? letters.find(l => l.id === openingId) ?? null : null
  const reading = readyId   ? letters.find(l => l.id === readyId)   ?? null : null

  const onOpenLetter = (letter: LetterStub) => {
    setError('')
    setOpeningId(letter.id)
    if (letter.direction === 'incoming' && !letter.read_at) {
      startTransition(async () => {
        await markLetterRead(letter.id)
        router.refresh()
      })
    }
  }

  const onAnimationDone = () => {
    setReadyId(openingId)
    setOpeningId(null)
  }

  const onClose = () => {
    setReadyId(null)
  }

  const onDelete = (id: string) => {
    if (pending) return
    startTransition(async () => {
      const res = await deleteLetterFromInbox(id)
      if (res?.error) { setError(res.error); return }
      setReadyId(null)
      router.refresh()
    })
  }

  const onReport = (id: string) => {
    if (pending) return
    startTransition(async () => {
      const res = await reportLetter(id, 'hateful')
      if (res?.error) setError(res.error)
      else setError('reported · sent to mods.')
    })
  }

  const onBlock = (handle: string) => {
    if (pending) return
    startTransition(async () => {
      const res = await blockSender(handle)
      if (res?.error) { setError(res.error); return }
      setReadyId(null)
      router.refresh()
    })
  }

  if (letters.length === 0) {
    return (
      <div className="panel" style={{ padding: 40, textAlign: 'center', marginBottom: 24 }}>
        <pre className="ascii muted" style={{ fontSize: 11, marginBottom: 14 }}>
{`╔══════════════════════════╗
║                          ║
║   [ NO LETTERS YET ]     ║
║                          ║
╚══════════════════════════╝`}
        </pre>
        <p className="muted">
          {box === 'inbox' ? '› nobody has written to you yet.' : '› you have not sent any letters.'}
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="panel" style={{ marginBottom: 24 }}>
        <div className="panel-header">
          <span>{box === 'inbox' ? 'INCOMING' : 'OUTGOING'}</span>
          <span className="muted">{letters.length}</span>
        </div>
        <div>
          {letters.map((letter, i) => {
            const unread = box === 'inbox' && !letter.read_at
            return (
              <button
                key={letter.id}
                type="button"
                className="post-row"
                onClick={() => onOpenLetter(letter)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  background: unread ? 'rgba(139, 38, 53, 0.05)' : 'transparent',
                  border: 0, font: 'inherit', cursor: 'pointer',
                }}
              >
                <div className="muted" style={{ fontSize: 12 }}>
                  {String(i + 1).padStart(3, '0')} ▸ {box === 'inbox' ? 'from' : 'to'}{' '}
                  <span className="accent">@</span>{letter.other_handle}
                  {unread && <span className="flag-badge" style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>new</span>}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35, margin: '2px 0 4px' }}>
                  {letter.title || '[untitled letter]'}
                </div>
                <div className="muted" style={{ fontSize: 11.5 }}>
                  {letter.word_count} wd · {timeAgo(letter.created_at)}
                  {box === 'inbox' && letter.read_at && <> · read</>}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {opening && (
        <EnvelopeOpen onDone={onAnimationDone} />
      )}

      {reading && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            background: 'rgba(42, 31, 18, 0.55)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            padding: '40px 16px',
            overflowY: 'auto',
          }}
        >
          <div
            className="panel"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 640, width: '100%', background: 'var(--paper)' }}
          >
            <div className="panel-header">
              <span>┌── LETTER ──┐</span>
              <button onClick={onClose} className="link" style={{ fontSize: 12 }}>[close]</button>
            </div>
            <div className="panel-body" style={{ padding: 20 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                {reading.direction === 'incoming' ? 'from' : 'to'}{' '}
                <Link href={`/u/${reading.other_handle}`} className="link">
                  <span className="accent">@</span>{reading.other_handle}
                </Link>
                {' · '}{timeAgo(reading.created_at)}
                {' · '}{reading.word_count} wd
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 700, margin: '4px 0 14px', lineHeight: 1.3 }}>
                {reading.title || <span className="muted">[untitled letter]</span>}
              </h2>
              <div className="essay-prose" style={{ whiteSpace: 'pre-wrap' }}>
                {reading.body}
              </div>

              {error && (
                <p className={error.startsWith('reported') ? 'positive' : 'accent'} style={{ fontSize: 12, marginTop: 14 }}>
                  {error.startsWith('reported') ? '✓' : '!'} {error}
                </p>
              )}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap', marginTop: 18 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {reading.direction === 'incoming' && (
                    <>
                      <Link
                        href={`/mailroom/new?to=${encodeURIComponent(reading.other_handle)}`}
                        className="btn btn-ghost"
                      >
                        ▸ write back
                      </Link>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => onReport(reading.id)}
                        disabled={pending}
                      >
                        report
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
                        onClick={() => onBlock(reading.other_handle)}
                        disabled={pending}
                      >
                        block @{reading.other_handle}
                      </button>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => onDelete(reading.id)}
                  disabled={pending}
                >
                  delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

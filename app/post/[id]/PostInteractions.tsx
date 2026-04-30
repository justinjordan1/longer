'use client'
import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { COMMENT_MIN_WORDS, FLAG_PRESETS, countWords, timeAgo } from '@/lib/longer'
import { castVote, createComment, fileReport } from '@/app/actions/posts'
import { modRemovePost, modSetFlag } from '@/app/actions/mod'

const VOTE_DWELL_MS = 3000

type Comment = {
  id: string
  body: string
  word_count: number
  created_at: string
  handle: string
}

type Props = {
  postId: string
  upCount: number
  downCount: number
  myVote: 'up' | 'down' | null
  comments: Comment[]
  myReports: { hateful: boolean; ai: boolean }
  isMod: boolean
  currentFlag: string | null
  modReports: { hateful: string[]; ai: string[] } | null
}

export default function PostInteractions(props: Props) {
  const { postId, upCount, downCount, myVote, comments, myReports, isMod, currentFlag, modReports } = props
  const router = useRouter()
  const [armedVote, setArmedVote] = useState<'up' | 'down' | null>(null)
  const [draft, setDraft] = useState('')
  const [commentError, setCommentError] = useState('')
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [confirmReport, setConfirmReport] = useState<'hateful' | 'ai' | null>(null)
  const [flagDraft, setFlagDraft] = useState(currentFlag ?? '')
  const [pending, startTransition] = useTransition()

  const words = countWords(draft)
  const meets = words >= COMMENT_MIN_WORDS
  const pct = Math.min(100, (words / COMMENT_MIN_WORDS) * 100)

  const submitComment = () => {
    if (!meets || pending) return
    setCommentError('')
    startTransition(async () => {
      const res = await createComment(postId, draft.trim())
      if (res?.error) setCommentError(res.error)
      else { setDraft(''); router.refresh() }
    })
  }

  const handleVote = (direction: 'up' | 'down') => {
    const next = myVote === direction ? null : direction
    startTransition(async () => {
      await castVote(postId, next)
      router.refresh()
    })
  }

  const handleReport = (kind: 'hateful' | 'ai') => {
    setConfirmReport(null)
    startTransition(async () => {
      await fileReport(postId, kind)
      router.refresh()
    })
  }

  const handleRemove = () => {
    setConfirmRemove(false)
    startTransition(async () => {
      await modRemovePost(postId)
      router.refresh()
    })
  }

  const applyFlag = () => {
    startTransition(async () => {
      await modSetFlag(postId, flagDraft || null)
      router.refresh()
    })
  }

  return (
    <>
      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-header">
          <span>┌── YOUR VOTE ──┐</span>
          <span className="muted">click → wait {VOTE_DWELL_MS / 1000}s → click</span>
        </div>
        <div className="panel-body">
          <div style={{ display: 'flex', gap: 8 }}>
            <VoteButton
              direction="up"
              label="upvote"
              count={upCount}
              isMine={myVote === 'up'}
              armed={armedVote === 'up'}
              onArm={() => setArmedVote('up')}
              onDisarm={() => setArmedVote(null)}
              onCommit={() => handleVote('up')}
              criteria="this was interesting and well written. (not necessarily agreement.)"
            />
            <VoteButton
              direction="down"
              label="downvote"
              count={downCount}
              isMine={myVote === 'down'}
              armed={armedVote === 'down'}
              onArm={() => setArmedVote('down')}
              onDisarm={() => setArmedVote(null)}
              onCommit={() => handleVote('down')}
              criteria="this was poorly written and not considered. (not necessarily disagreement.)"
            />
          </div>
          {myVote && (
            <p className="muted" style={{ fontSize: 12, marginTop: 10, marginBottom: 0 }}>
              › you {myVote === 'up' ? 'upvoted' : 'downvoted'}. click and confirm to retract or switch.
            </p>
          )}
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 24 }}>
        <div className="panel-header"><span>┌── REPORT ──┐</span></div>
        <div className="panel-body" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            className="btn btn-ghost"
            disabled={myReports.hateful || pending}
            onClick={() => setConfirmReport('hateful')}
            style={{ flex: 1, minWidth: 220 }}
          >
            {myReports.hateful ? '✓ reported · hateful' : '! report — hateful messaging'}
          </button>
          <button
            className="btn btn-ghost"
            disabled={myReports.ai || pending}
            onClick={() => setConfirmReport('ai')}
            style={{ flex: 1, minWidth: 220 }}
          >
            {myReports.ai ? '✓ reported · ai language' : '! report — ai-generated language'}
          </button>
        </div>
      </div>

      {isMod && (
        <div className="panel mod-panel" style={{ marginBottom: 24 }}>
          <div className="panel-header"><span>┌── MODERATOR TOOLS ──┐</span></div>
          <div className="panel-body" style={{ padding: 16 }}>
            {modReports && (modReports.hateful.length > 0 || modReports.ai.length > 0) && (
              <div style={{ marginBottom: 14, fontSize: 13 }}>
                <div className="smallcaps muted" style={{ fontSize: 11.5, marginBottom: 6 }}>open reports</div>
                {modReports.hateful.length > 0 && (
                  <div style={{ marginBottom: 4 }}>
                    <span className="accent">! hateful ({modReports.hateful.length}):</span>{' '}
                    <span className="muted">{modReports.hateful.map(h => '@' + h).join(', ')}</span>
                  </div>
                )}
                {modReports.ai.length > 0 && (
                  <div style={{ marginBottom: 4 }}>
                    <span className="caution">⚠ ai ({modReports.ai.length}):</span>{' '}
                    <span className="muted">{modReports.ai.map(h => '@' + h).join(', ')}</span>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              <button
                className="btn"
                style={{ background: 'var(--accent)', borderColor: 'var(--accent)' }}
                disabled={pending}
                onClick={() => setConfirmRemove(true)}
              >
                ▸ remove post
              </button>
            </div>

            <div style={{ borderTop: '1px dashed var(--rule)', paddingTop: 14 }}>
              <div className="smallcaps muted" style={{ fontSize: 11.5, marginBottom: 8 }}>editorial flag</div>
              <div className="field" style={{ marginBottom: 8 }}>
                <select value={flagDraft} onChange={(e) => setFlagDraft(e.target.value)}>
                  <option value="">— no flag —</option>
                  {FLAG_PRESETS.map(f => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>
              <button
                className="btn btn-ghost"
                disabled={flagDraft === (currentFlag ?? '') || pending}
                onClick={applyFlag}
              >
                ▸ apply flag
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-header">
          <span>┌── RESPONSES ──┐</span>
          <span className="muted">{comments.length}</span>
        </div>
        <div className="panel-body" style={{ padding: 18 }}>
          {comments.length === 0 && (
            <p className="muted" style={{ fontStyle: 'italic', margin: '0 0 16px' }}>
              › no responses yet. add the first considered reply.
            </p>
          )}
          {comments.map((c, i) => (
            <div key={c.id} className="comment-block">
              <div className="muted" style={{ fontSize: 11.5, marginBottom: 4 }}>
                {String(i + 1).padStart(3, '0')} · <span className="accent">@</span>{c.handle} · {timeAgo(c.created_at)} ago · {c.word_count} wd
              </div>
              <div style={{ fontSize: 13.5, lineHeight: 1.65 }}>{c.body}</div>
            </div>
          ))}

          <div style={{ borderTop: '1px dashed var(--rule)', paddingTop: 18, marginTop: 4 }}>
            <p className="smallcaps muted" style={{ fontSize: 11.5, margin: '0 0 6px' }}>add response</p>
            <div className="field" style={{ marginBottom: 10 }}>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={`a response. minimum ${COMMENT_MIN_WORDS} words.`}
                style={{ minHeight: 140, resize: 'vertical' }}
                disabled={pending}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <span className="muted" style={{ fontSize: 12 }}>word count</span>
              <span style={{ fontVariantNumeric: 'tabular-nums', color: meets ? 'var(--positive)' : 'var(--ink-soft)' }}>
                {words} <span className="muted">/ {COMMENT_MIN_WORDS}</span>
              </span>
            </div>
            <div className="progress-track" style={{ marginBottom: 12 }}>
              <div className={`progress-fill ${meets ? 'ok' : ''}`} style={{ width: `${pct}%` }} />
            </div>
            {commentError && (
              <p className="accent" style={{ fontSize: 13, marginBottom: 10 }}>! {commentError}</p>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn" disabled={!meets || pending} onClick={submitComment}>
                {pending ? 'submitting...' : meets ? '▸ post response' : `${COMMENT_MIN_WORDS - words} more words`}
              </button>
            </div>
          </div>
        </div>
      </div>

      {confirmRemove && (
        <ConfirmModal
          title="remove post"
          body="this will replace the body with a removal notice. comments and votes are preserved. you can restore it later."
          confirmLabel="Remove Post"
          onConfirm={handleRemove}
          onCancel={() => setConfirmRemove(false)}
        />
      )}
      {confirmReport && (
        <ConfirmModal
          title={`report — ${confirmReport === 'hateful' ? 'hateful messaging' : 'ai-generated language'}`}
          body={`flag this post for moderator review. this action cannot be undone and is recorded against your account if used in bad faith.`}
          confirmLabel="Submit Report"
          onConfirm={() => handleReport(confirmReport)}
          onCancel={() => setConfirmReport(null)}
        />
      )}
    </>
  )
}

function VoteButton({
  direction, label, count, isMine, armed, onArm, onDisarm, onCommit, criteria,
}: {
  direction: 'up' | 'down'
  label: string
  count: number
  isMine: boolean
  armed: boolean
  onArm: () => void
  onDisarm: () => void
  onCommit: () => void
  criteria: string
}) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!armed) { setElapsed(0); return }
    const start = Date.now()
    const ti = setInterval(() => setElapsed(Date.now() - start), 50)
    return () => clearInterval(ti)
  }, [armed])
  useEffect(() => {
    if (armed && elapsed > 15000) onDisarm()
  }, [armed, elapsed, onDisarm])

  const ready = armed && elapsed >= VOTE_DWELL_MS
  const progress = armed ? Math.min(1, elapsed / VOTE_DWELL_MS) : 0
  const remainingMs = Math.max(0, VOTE_DWELL_MS - elapsed)

  const handleClick = () => {
    if (!armed) onArm()
    else if (ready) { onCommit(); onDisarm() }
  }

  const sym = direction === 'up' ? '+' : '−'
  const lbl = !armed
    ? `[ ${sym} ${label}${isMine ? ' ✓' : ''} ]`
    : !ready
      ? `[ ${sym} wait ${(remainingMs / 1000).toFixed(1)}s... ]`
      : `[ ✓ click again to confirm ]`

  return (
    <button
      onClick={handleClick}
      className={`vote-btn ${direction} ${isMine ? 'active' : ''} ${armed ? 'armed' : ''} ${ready ? 'ready' : ''}`}
      style={{ flex: 1 }}
    >
      <div className="vote-fill" style={{ width: `${progress * 100}%` }} />
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontWeight: 600 }}>{lbl}</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{count}</span>
      </div>
      <div className="vote-criteria">
        {!armed
          ? <span className="muted">› {criteria}</span>
          : !ready
            ? <span><span className="muted">› arming · </span>{(remainingMs / 1000).toFixed(1)}s until confirmable <span className="muted">· </span>
                <span className="link" onClick={(e) => { e.stopPropagation(); onDisarm() }} style={{ fontSize: 12 }}>cancel</span>
              </span>
            : <span>
                <span className="positive">› ready — click again to confirm</span>
                <span className="muted"> · </span>
                <span className="link" onClick={(e) => { e.stopPropagation(); onDisarm() }} style={{ fontSize: 12 }}>cancel</span>
              </span>}
      </div>
    </button>
  )
}

function ConfirmModal({
  title, body, confirmLabel, onConfirm, onCancel,
}: {
  title: string
  body: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(42,31,18,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 50, padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--paper)', border: '1px solid var(--ink)',
          maxWidth: 480, width: '100%',
          boxShadow: '8px 8px 0 var(--ink)',
        }}
      >
        <div className="panel-header" style={{ background: 'var(--paper-3)' }}>
          <span>! {title}</span>
          <button className="link" onClick={onCancel} style={{ fontSize: 12 }}>[esc]</button>
        </div>
        <div style={{ padding: 16 }}>
          <p style={{ margin: '0 0 16px', lineHeight: 1.55 }}>{body}</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
            <button
              className="btn"
              onClick={onConfirm}
              style={{ background: 'var(--accent)', borderColor: 'var(--accent)' }}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

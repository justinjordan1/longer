'use client'
import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { POST_MIN_WORDS, countWords } from '@/lib/longer'
import LiveTimeUntil from '@/app/LiveTimeUntil'
import {
  createPost,
  discardPostDraft,
  updateScheduledPost,
  discardScheduledPost,
  savePostDraft,
  submitPostDraft,
} from '@/app/actions/posts'

type Props =
  | { mode: 'new' }
  | {
      mode: 'draft'
      draftId: string
      initialTitle: string
      initialBody: string
      postVisibility: 'feed' | 'profile'
      updatedAt: string
    }
  | {
      mode: 'edit'
      postId: string
      initialTitle: string
      initialBody: string
      postVisibility: 'feed' | 'profile'
      publishAt: string
    }

export default function ComposeForm(props: Props) {
  const isEdit = props.mode === 'edit'
  const isDraft = props.mode === 'draft'
  const router = useRouter()

  const [draftId, setDraftId] = useState(isDraft ? props.draftId : '')
  const [title, setTitle] = useState(props.mode === 'new' ? '' : props.initialTitle)
  const [body,  setBody]  = useState(props.mode === 'new' ? '' : props.initialBody)
  const [postVisibility, setPostVisibility] = useState<'feed' | 'profile'>(
    props.mode === 'new' ? 'feed' : props.postVisibility,
  )
  const [error, setError] = useState('')
  const [savedMessage, setSavedMessage] = useState('')
  const [pending, startTransition] = useTransition()
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)

  const words = countWords(body)
  const meets = words >= POST_MIN_WORDS
  const ready = meets && title.trim().length > 0
  const canSaveDraft = title.trim().length > 0 || body.trim().length > 0
  const pct = Math.min(100, (words / POST_MIN_WORDS) * 100)

  const formData = () => {
    const fd = new FormData()
    fd.set('title', title.trim())
    fd.set('body', body.trim())
    fd.set('post_visibility', postVisibility)
    return fd
  }

  const onSubmit = () => {
    if (!ready || pending) return
    setError('')
    startTransition(async () => {
      const res = isEdit
        ? await updateScheduledPost(props.postId, formData())
        : draftId
          ? await submitPostDraft(draftId, formData())
          : await createPost(formData())
      if (res?.error) setError(res.error)
    })
  }

  const onSaveDraft = () => {
    if (!canSaveDraft || pending) return
    setError('')
    setSavedMessage('')
    startTransition(async () => {
      const res = await savePostDraft(draftId || null, formData())
      if (res?.error) {
        setError(res.error)
        return
      }
      if (res?.draftId) setDraftId(res.draftId)
      setSavedMessage('draft saved.')
      if (!draftId && res?.draftId) {
        router.replace(`/compose?draft=${res.draftId}`)
      }
      router.refresh()
    })
  }

  const onSaveAndExit = () => {
    if (pending) return

    if (!canSaveDraft) {
      router.push('/')
      return
    }

    setError('')
    setSavedMessage('')
    startTransition(async () => {
      const res = await savePostDraft(draftId || null, formData())
      if (res?.error) {
        setError(res.error)
        return
      }
      router.push('/')
      router.refresh()
    })
  }

  const onDiscard = () => {
    if (pending) return
    startTransition(async () => {
      const res = isEdit
        ? await discardScheduledPost(props.postId)
        : draftId
          ? await discardPostDraft(draftId)
          : { success: true }
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
          <span>{isEdit ? '┌── REVIEW EDIT ──┐' : isDraft ? '┌── DRAFT ──┐' : '┌── NEW ESSAY ──┐'}</span>
          {isEdit && (
            <span className="muted">
              publishes in <LiveTimeUntil iso={props.publishAt} whenPassed="any moment now" />
            </span>
          )}
          {isDraft && (
            <span className="muted">
              saved {new Date(props.updatedAt).toLocaleDateString()}
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
              placeholder="give your work a title."
              maxLength={200}
              style={{ fontSize: 18, fontWeight: 600 }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 6px' }}>
            <p className="smallcaps muted" style={{ fontSize: 11.5, margin: 0 }}>body</p>
          </div>
          <RichBodyEditor
            value={body}
            onChange={setBody}
            placeholder={`write something worth reading. minimum ${POST_MIN_WORDS} words. take your time.`}
          />
          <p className="muted" style={{ fontSize: 11.5, margin: '-8px 0 16px' }}>
            formatting saves as simple markdown: bold and italic only.
          </p>

          <div className="scheduled" style={{ marginBottom: 18 }}>
            <div className="smallcaps muted" style={{ fontSize: 11.5, marginBottom: 8 }}>
              post to
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
              <button
                type="button"
                className={postVisibility === 'feed' ? 'btn' : 'btn btn-ghost'}
                onClick={() => setPostVisibility('feed')}
                disabled={pending}
                style={{ textAlign: 'left', justifyContent: 'flex-start' }}
              >
                ▸ main feed
              </button>
              <button
                type="button"
                className={postVisibility === 'profile' ? 'btn' : 'btn btn-ghost'}
                onClick={() => setPostVisibility('profile')}
                disabled={pending}
                style={{ textAlign: 'left', justifyContent: 'flex-start' }}
              >
                ▸ profile only
              </button>
            </div>
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
                ? <>your essay publishes in <LiveTimeUntil iso={props.publishAt} whenPassed="any moment" />. you can keep editing until then. once published, the post is locked.</>
              : isDraft
                  ? <>drafts are private. when ready, submit for review and your essay enters the 5-minute review window.</>
                  : <>once submitted, your essay enters review for 5 minutes. profile-only posts appear on your profile but skip the main feed. one post per 24 hours.</>}
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
              {!confirmingDiscard && (
                <button
                  className="btn btn-ghost"
                  style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
                  onClick={() => setConfirmingDiscard(true)}
                  disabled={pending}
                >
                  ▸ discard {isEdit ? 'review' : 'draft'}
                </button>
              )}
              {confirmingDiscard && (
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

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {isEdit ? (
                <Link href="/" className="btn btn-ghost">Back</Link>
              ) : (
                <button
                  className="btn btn-ghost"
                  disabled={pending}
                  onClick={onSaveAndExit}
                >
                  {pending ? 'saving...' : 'Save & Exit'}
                </button>
              )}
              {!isEdit && (
                <button
                  className="btn btn-ghost"
                  disabled={!canSaveDraft || pending}
                  onClick={onSaveDraft}
                >
                  {pending ? 'saving...' : 'Save Draft'}
                </button>
              )}
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

function RichBodyEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  const editorRef = useRef<HTMLDivElement>(null)
  const initialValue = useRef(value)
  const [empty, setEmpty] = useState(value.trim().length === 0)

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    editor.innerHTML = markdownToEditorHtml(initialValue.current)
    setEmpty(initialValue.current.trim().length === 0)
  }, [])

  const syncMarkdown = () => {
    const editor = editorRef.current
    if (!editor) return
    const next = editorHtmlToMarkdown(editor)
    setEmpty(next.trim().length === 0)
    onChange(next)
  }

  const applyFormat = (kind: 'bold' | 'italic') => {
    const editor = editorRef.current
    if (!editor) return

    editor.focus()
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return

    const range = selection.getRangeAt(0)
    if (!editor.contains(range.commonAncestorContainer)) return

    const command = kind === 'bold' ? 'bold' : 'italic'
    if (range.collapsed || isSelectionFullyFormatted(range, editor, kind)) {
      document.execCommand(command)
      setTimeout(syncMarkdown, 0)
      return
    }

    const wrapper = document.createElement(kind === 'bold' ? 'strong' : 'em')
    wrapper.appendChild(range.extractContents())
    range.insertNode(wrapper)

    const nextRange = document.createRange()
    nextRange.selectNodeContents(wrapper)
    selection.removeAllRanges()
    selection.addRange(nextRange)
    syncMarkdown()
  }

  const onPaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault()
    const text = event.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, text)
    setTimeout(syncMarkdown, 0)
  }

  return (
    <div style={{ position: 'relative', marginBottom: 16 }}>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginBottom: 6 }}>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => applyFormat('bold')}
          style={{ padding: '3px 8px', fontWeight: 700 }}
          title="Bold"
        >
          B
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => applyFormat('italic')}
          style={{ padding: '3px 8px', fontStyle: 'italic' }}
          title="Italic"
        >
          I
        </button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={syncMarkdown}
        onPaste={onPaste}
        className="field"
        style={{
          minHeight: 360,
          whiteSpace: 'pre-wrap',
          overflowWrap: 'break-word',
        }}
      />
      {empty && (
        <div
          className="muted"
          style={{
            pointerEvents: 'none',
            position: 'absolute',
            left: 11,
            top: 43,
            fontStyle: 'italic',
          }}
        >
          {placeholder}
        </div>
      )}
    </div>
  )
}

function isSelectionFullyFormatted(
  range: Range,
  root: HTMLElement,
  kind: 'bold' | 'italic',
) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  let current = walker.nextNode()

  while (current) {
    if (
      current.textContent?.trim() &&
      range.intersectsNode(current)
    ) {
      textNodes.push(current as Text)
    }
    current = walker.nextNode()
  }

  return textNodes.length > 0 && textNodes.every((node) => textNodeHasFormat(node, root, kind))
}

function textNodeHasFormat(
  node: Text,
  root: HTMLElement,
  kind: 'bold' | 'italic',
) {
  let current: Node | null = node.parentElement
  const tags = kind === 'bold' ? ['STRONG', 'B'] : ['EM', 'I']

  while (current && current !== root) {
    if (current instanceof HTMLElement && tags.includes(current.tagName)) {
      return true
    }
    current = current.parentNode
  }

  return false
}

function markdownToEditorHtml(markdown: string) {
  const parts = markdown.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)

  return parts.map((part) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return `<strong>${escapeHtml(part.slice(2, -2))}</strong>`
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return `<em>${escapeHtml(part.slice(1, -1))}</em>`
    }
    return escapeHtml(part)
  }).join('')
}

function editorHtmlToMarkdown(root: HTMLElement) {
  return Array.from(root.childNodes)
    .map((node) => serializeEditorNode(node, root, false, false))
    .join('')
    .replace(/\u00a0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd()
}

function serializeEditorNode(
  node: Node,
  root: HTMLElement,
  activeBold: boolean,
  activeItalic: boolean,
): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? ''
  }

  if (!(node instanceof HTMLElement)) return ''
  if (node.tagName === 'BR') return '\n'

  const isBold = node.tagName === 'STRONG' || node.tagName === 'B'
  const isItalic = node.tagName === 'EM' || node.tagName === 'I'
  const nextBold = activeBold || isBold
  const nextItalic = activeItalic || isItalic
  let content = Array.from(node.childNodes)
    .map((child) => serializeEditorNode(child, root, nextBold, nextItalic))
    .join('')

  if (isBold && !activeBold) content = `**${content}**`
  if (isItalic && !activeItalic) content = `*${content}*`

  if (node !== root && (node.tagName === 'DIV' || node.tagName === 'P')) {
    content += '\n'
  }

  return content
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

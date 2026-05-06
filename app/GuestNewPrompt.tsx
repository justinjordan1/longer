'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function GuestNewPrompt() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <pre className="ascii muted" style={{ fontSize: 13 }}>
{`┌─[ FRONT PAGE ]─────────────────`}
        </pre>
        <button type="button" className="btn" onClick={() => setOpen(true)}>
          ▸ NEW
        </button>
      </div>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(42,31,18,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 50, padding: 20,
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              background: 'var(--paper)', border: '1px solid var(--ink)',
              maxWidth: 480, width: '100%',
              boxShadow: '8px 8px 0 var(--ink)',
            }}
          >
            <div className="panel-header" style={{ background: 'var(--paper-3)' }}>
              <span>┌── SIGN IN/UP ──┐</span>
              <button className="link" onClick={() => setOpen(false)} style={{ fontSize: 12 }}>
                [esc]
              </button>
            </div>
            <div style={{ padding: 16 }}>
              <p style={{ margin: '0 0 16px', lineHeight: 1.55 }}>
                You&apos;ll need to sign in/up before you can write something new.
              </p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button className="btn btn-ghost" onClick={() => setOpen(false)}>
                  Cancel
                </button>
                <Link href="/login" className="btn">
                  Sign in/up
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

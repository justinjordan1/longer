'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { unblockSender } from '@/app/actions/letters'

export type BlockedStub = {
  id: string
  handle: string
  created_at: string
}

export default function BlockList({ blocked }: { blocked: BlockedStub[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  if (blocked.length === 0) return null

  const onUnblock = (id: string) => {
    if (pending) return
    startTransition(async () => {
      await unblockSender(id)
      router.refresh()
    })
  }

  return (
    <div style={{ marginTop: 18 }}>
      <button
        type="button"
        className="link"
        onClick={() => setOpen(o => !o)}
        style={{ fontSize: 12 }}
      >
        {open ? 'hide' : 'show'} blocked senders ({blocked.length})
      </button>

      {open && (
        <div className="panel" style={{ marginTop: 8 }}>
          <div className="panel-header">
            <span>BLOCKED</span>
            <span className="muted">{blocked.length}</span>
          </div>
          <div>
            {blocked.map(b => (
              <div
                key={b.id}
                style={{
                  borderTop: '1px dashed var(--rule)',
                  padding: '8px 10px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  fontSize: 13,
                }}
              >
                <span><span className="accent">@</span>{b.handle}</span>
                <button
                  type="button"
                  className="link"
                  style={{ fontSize: 12 }}
                  disabled={pending}
                  onClick={() => onUnblock(b.id)}
                >
                  unblock
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

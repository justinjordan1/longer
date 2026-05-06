'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SearchBox({ initial = '' }: { initial?: string }) {
  const [q, setQ] = useState(initial)
  const router = useRouter()

  const submit = () => {
    const trimmed = q.trim()
    if (!trimmed) return
    router.push(`/search?q=${encodeURIComponent(trimmed)}`)
  }

  return (
    <div>
      <div className="field" style={{ marginBottom: 10 }}>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="search posts or users..."
          style={{ fontSize: 16 }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn" onClick={submit} disabled={!q.trim()}>
          ▸ search
        </button>
      </div>
    </div>
  )
}

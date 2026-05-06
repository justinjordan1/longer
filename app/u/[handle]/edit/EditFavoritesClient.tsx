'use client'
import { useState, useEffect, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { setFavorite, removeFavorite, moveFavorite } from '@/app/actions/favorites'

type Kind = 'book' | 'movie' | 'album'

type Favorite = {
  kind: Kind
  position: number
  external_id: string
  title: string
  subtitle: string | null
  cover_url: string | null
}

type SearchResult = {
  external_id: string
  title: string
  subtitle: string
  cover_url: string | null
}

type AdvancedCoverState = {
  result: SearchResult
  status: 'searching' | 'found' | 'not-found' | 'error'
  cover_url: string | null
  source: string | null
  error?: string
}

export default function EditFavoritesClient({ initial }: { initial: Favorite[] }) {
  const router = useRouter()
  const [favs, setFavs] = useState<Favorite[]>(initial)
  const [editingSlot, setEditingSlot] = useState<{ kind: Kind; position: number } | null>(null)
  const [pending, startTransition] = useTransition()

  const books  = favs.filter(f => f.kind === 'book').sort((a, b) => a.position - b.position)
  const movies = favs.filter(f => f.kind === 'movie').sort((a, b) => a.position - b.position)
  const albums = favs.filter(f => f.kind === 'album').sort((a, b) => a.position - b.position)

  const slots = (kind: Kind, list: Favorite[]) => {
    const arr: (Favorite | null)[] = [null, null, null, null, null]
    for (const f of list) arr[f.position - 1] = f
    return arr
  }

  const refresh = () => router.refresh()

  const onPick = (kind: Kind, position: number, r: SearchResult) => {
    startTransition(async () => {
      const res = await setFavorite({
        kind, position,
        external_id: r.external_id,
        title:       r.title,
        subtitle:    r.subtitle || null,
        cover_url:   r.cover_url,
      })
      if (!res?.error) {
        const saved = res.favorite ?? {
          kind,
          position,
          external_id: r.external_id,
          title: r.title,
          subtitle: r.subtitle || null,
          cover_url: r.cover_url,
        }
        setFavs(prev => {
          const without = prev.filter(f => !(f.kind === kind && f.position === position))
          return [...without, saved]
        })
        setEditingSlot(null)
        refresh()
      }
    })
  }

  const onRemove = (kind: Kind, position: number) => {
    startTransition(async () => {
      const res = await removeFavorite(kind, position)
      if (!res?.error) {
        setFavs(prev => prev.filter(f => !(f.kind === kind && f.position === position)))
        refresh()
      }
    })
  }

  const onMove = (kind: Kind, from: number, to: number) => {
    if (to < 1 || to > 5) return
    startTransition(async () => {
      const res = await moveFavorite(kind, from, to)
      if (!res?.error) {
        setFavs(prev => {
          const next = [...prev]
          const fromIdx = next.findIndex(f => f.kind === kind && f.position === from)
          const toIdx   = next.findIndex(f => f.kind === kind && f.position === to)
          if (fromIdx >= 0) next[fromIdx] = { ...next[fromIdx], position: to }
          if (toIdx >= 0)   next[toIdx]   = { ...next[toIdx],   position: from }
          return next
        })
        refresh()
      }
    })
  }

  return (
    <div>
      <Section
        title="BOOKS"
        kind="book"
        slots={slots('book', books)}
        editingSlot={editingSlot}
        setEditingSlot={setEditingSlot}
        onPick={onPick}
        onRemove={onRemove}
        onMove={onMove}
        pending={pending}
      />
      <div style={{ height: 24 }} />
      <Section
        title="MOVIES"
        kind="movie"
        slots={slots('movie', movies)}
        editingSlot={editingSlot}
        setEditingSlot={setEditingSlot}
        onPick={onPick}
        onRemove={onRemove}
        onMove={onMove}
        pending={pending}
      />
      <div style={{ height: 24 }} />
      <Section
        title="ALBUMS"
        kind="album"
        slots={slots('album', albums)}
        editingSlot={editingSlot}
        setEditingSlot={setEditingSlot}
        onPick={onPick}
        onRemove={onRemove}
        onMove={onMove}
        pending={pending}
      />
    </div>
  )
}

function Section({
  title, kind, slots, editingSlot, setEditingSlot, onPick, onRemove, onMove, pending,
}: {
  title: string
  kind: Kind
  slots: (Favorite | null)[]
  editingSlot: { kind: Kind; position: number } | null
  setEditingSlot: (s: { kind: Kind; position: number } | null) => void
  onPick: (kind: Kind, position: number, r: SearchResult) => void
  onRemove: (kind: Kind, position: number) => void
  onMove: (kind: Kind, from: number, to: number) => void
  pending: boolean
}) {
  return (
    <div>
      <p className="smallcaps muted" style={{ fontSize: 11.5, margin: '0 0 10px' }}>{title}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {slots.map((slot, i) => {
          const position = i + 1
          const isEditing = editingSlot?.kind === kind && editingSlot.position === position
          return (
            <div key={position}>
              <Slot
                kind={kind}
                position={position}
                slot={slot}
                onEdit={() => setEditingSlot({ kind, position })}
                onCancelEdit={() => setEditingSlot(null)}
                onRemove={() => onRemove(kind, position)}
                onMove={(dir) => onMove(kind, position, position + dir)}
                pending={pending}
                editing={isEditing}
              />
              {isEditing && (
                <div style={{ marginTop: 6 }}>
                  <SearchPicker
                    kind={kind}
                    onPick={(r) => onPick(kind, position, r)}
                    pending={pending}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Slot({
  kind, position, slot, onEdit, onCancelEdit, onRemove, onMove, pending, editing,
}: {
  kind: Kind
  position: number
  slot: Favorite | null
  onEdit: () => void
  onCancelEdit: () => void
  onRemove: () => void
  onMove: (dir: -1 | 1) => void
  pending: boolean
  editing: boolean
}) {
  if (!slot) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        border: '1px dashed var(--rule)', padding: '10px 12px',
        background: editing ? 'var(--paper-2)' : 'transparent',
      }}>
        <span className="muted" style={{ fontSize: 12, minWidth: 18 }}>{position}.</span>
        {editing ? (
          <button className="link muted" onClick={onCancelEdit} style={{ fontSize: 12 }}>cancel</button>
        ) : (
          <button className="link" onClick={onEdit} style={{ fontSize: 12 }}>+ add a {kind}</button>
        )}
      </div>
    )
  }
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      border: '1px solid var(--rule)', padding: 8,
      background: 'var(--paper)',
    }}>
      <span className="muted" style={{ fontSize: 12, minWidth: 18 }}>{position}.</span>
      <div style={{
        width: 36, height: kind === 'album' ? 36 : 54,
        background: 'var(--paper-2)',
        backgroundImage: slot.cover_url ? `url(${slot.cover_url})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        flexShrink: 0,
      }} />
      <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
        <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {slot.title}
        </div>
        {slot.subtitle && <div className="muted" style={{ fontSize: 11.5 }}>{slot.subtitle}</div>}
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button className="link muted" onClick={() => onMove(-1)} disabled={pending || position === 1} style={{ fontSize: 14 }} title="move up">↑</button>
        <button className="link muted" onClick={() => onMove(1)}  disabled={pending || position === 5} style={{ fontSize: 14 }} title="move down">↓</button>
        <button className="link accent" onClick={onRemove} disabled={pending} style={{ fontSize: 14 }} title="remove">×</button>
      </div>
    </div>
  )
}

function SearchPicker({ kind, onPick, pending }: { kind: Kind; onPick: (r: SearchResult) => void; pending: boolean }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [advanced, setAdvanced] = useState<AdvancedCoverState | null>(null)
  const reqIdRef = useRef(0)
  const trimmed = q.trim()
  const visibleResults = trimmed ? results : []

  const pickResult = async (result: SearchResult) => {
    if (result.cover_url || (kind !== 'book' && kind !== 'album')) {
      onPick(result)
      return
    }

    setAdvanced({ result, status: 'searching', cover_url: null, source: null })

    const params = new URLSearchParams({
      kind,
      external_id: result.external_id,
      title: result.title,
      subtitle: result.subtitle,
    })

    try {
      const res = await fetch(`/api/search/covers?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) {
        setAdvanced({
          result,
          status: 'error',
          cover_url: null,
          source: null,
          error: data.error ?? 'cover search failed',
        })
        return
      }

      setAdvanced({
        result,
        status: data.cover_url ? 'found' : 'not-found',
        cover_url: data.cover_url ?? null,
        source: data.source ?? null,
      })
    } catch (err) {
      setAdvanced({
        result,
        status: 'error',
        cover_url: null,
        source: null,
        error: err instanceof Error ? err.message : 'cover search failed',
      })
    }
  }

  useEffect(() => {
    const trimmed = q.trim()
    if (!trimmed) { reqIdRef.current += 1; return }
    const myReq = ++reqIdRef.current
    const t = setTimeout(async () => {
      try {
        const path =
          kind === 'book'
            ? '/api/search/books'
            : kind === 'movie'
              ? '/api/search/movies'
              : '/api/search/albums'
        const res = await fetch(`${path}?q=${encodeURIComponent(trimmed)}`)
        const data = await res.json()
        if (myReq !== reqIdRef.current) return  // a newer query has fired
        setResults(data.results ?? [])
      } finally {
        if (myReq === reqIdRef.current) setLoading(false)
      }
    }, 350)
    return () => clearTimeout(t)
  }, [q, kind])

  return (
    <div style={{ border: '1px solid var(--rule)', padding: 10, background: 'var(--paper-2)' }}>
      <div className="field" style={{ marginBottom: 8, background: 'var(--paper)' }}>
        <input
          autoFocus
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setLoading(Boolean(e.target.value.trim()))
            setAdvanced(null)
          }}
          placeholder={`search for a ${kind}...`}
          style={{ fontSize: 14 }}
        />
      </div>
      {loading && trimmed && <p className="muted" style={{ fontSize: 12, margin: '4px 0' }}>searching...</p>}
      {!loading && trimmed && visibleResults.length === 0 && (
        <p className="muted" style={{ fontSize: 12, margin: '4px 0', fontStyle: 'italic' }}>no results.</p>
      )}
      {advanced && (
        <div style={{
          display: 'flex',
          gap: 10,
          border: '1px solid var(--rule)',
          background: 'var(--paper)',
          padding: 10,
          margin: '8px 0',
        }}>
          <div style={{
            width: 52,
            height: kind === 'album' ? 52 : 78,
            background: 'var(--paper-3)',
            backgroundImage: advanced.cover_url ? `url(${advanced.cover_url})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            border: '1px solid var(--rule)',
            flexShrink: 0,
          }} />
          <div style={{ minWidth: 0, flex: 1, fontSize: 12.5 }}>
            <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {advanced.result.title}
            </div>
            {advanced.result.subtitle && <div className="muted">{advanced.result.subtitle}</div>}
            <div className="muted" style={{ marginTop: 6, fontStyle: 'italic' }}>
              {advanced.status === 'searching' && 'cover not found. running advanced search...'}
              {advanced.status === 'found' && `cover found${advanced.source ? ` via ${advanced.source}` : ''}.`}
              {advanced.status === 'not-found' && 'advanced search did not find a cover.'}
              {advanced.status === 'error' && `advanced search failed: ${advanced.error}`}
            </div>
            {advanced.status !== 'searching' && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
                {advanced.cover_url && (
                  <button
                    className="link"
                    disabled={pending}
                    onClick={() => onPick({ ...advanced.result, cover_url: advanced.cover_url })}
                    style={{ fontSize: 12 }}
                  >
                    save with cover
                  </button>
                )}
                <button
                  className="link muted"
                  disabled={pending}
                  onClick={() => onPick(advanced.result)}
                  style={{ fontSize: 12 }}
                >
                  save without cover
                </button>
                <button
                  className="link muted"
                  disabled={pending}
                  onClick={() => setAdvanced(null)}
                  style={{ fontSize: 12 }}
                >
                  cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {visibleResults.map(r => (
        <button
          key={r.external_id}
          onClick={() => { void pickResult(r) }}
          disabled={pending || advanced?.status === 'searching'}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            width: '100%', textAlign: 'left',
            background: 'transparent', border: 0,
            padding: '6px 4px', cursor: pending ? 'default' : 'pointer',
            font: 'inherit', color: 'inherit',
            borderTop: '1px dashed var(--rule)',
          }}
          className="picker-row"
        >
          <div style={{
            width: 32, height: kind === 'album' ? 32 : 48,
            background: 'var(--paper-3)',
            backgroundImage: r.cover_url ? `url(${r.cover_url})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            flexShrink: 0,
          }} />
          <div style={{ minWidth: 0, fontSize: 12.5 }}>
            <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
            {r.subtitle && <div className="muted">{r.subtitle}</div>}
          </div>
        </button>
      ))}
    </div>
  )
}

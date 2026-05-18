'use client'
import { useEffect, useState } from 'react'

export default function EnvelopeOpen({
  onDone,
  durationMs = 700,
}: {
  onDone?: () => void
  durationMs?: number
}) {
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setOpen(true), 120)
    const t2 = setTimeout(() => {
      setDone(true)
      onDone?.()
    }, durationMs)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [durationMs, onDone])

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(42, 31, 18, 0.55)',
        pointerEvents: done ? 'none' : 'auto',
        opacity: done ? 0 : 1,
        transition: 'opacity 200ms ease',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: 192, height: 192,
          imageRendering: 'pixelated',
        }}
      >
        <EnvelopeFrame variant="closed" visible={!open} />
        <EnvelopeFrame variant="open"   visible={open} />
      </div>
    </div>
  )
}

function EnvelopeFrame({
  variant,
  visible,
}: {
  variant: 'closed' | 'open'
  visible: boolean
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="192"
      height="192"
      shapeRendering="crispEdges"
      style={{
        position: 'absolute', inset: 0,
        opacity: visible ? 1 : 0,
        transition: 'opacity 220ms steps(4, end)',
      }}
    >
      {/* tan rounded-square background */}
      <rect x="0" y="0" width="24" height="24" fill="var(--paper-3)" />

      {variant === 'closed' ? <ClosedEnvelope /> : <OpenEnvelope />}
    </svg>
  )
}

function ClosedEnvelope() {
  // pixel art on a 24x24 grid. ink = var(--ink)
  // envelope body: x 3..21, y 7..18
  return (
    <g fill="var(--ink)">
      {/* top edge */}
      <rect x="3"  y="7"  width="18" height="1" />
      {/* bottom edge */}
      <rect x="3"  y="18" width="18" height="1" />
      {/* left edge */}
      <rect x="3"  y="7"  width="1"  height="12" />
      {/* right edge */}
      <rect x="20" y="7"  width="1"  height="12" />
      {/* flap diagonals — meeting at bottom center */}
      {/* left diagonal: from (4,8) -> (11,14) */}
      <rect x="4"  y="8"  width="1" height="1" />
      <rect x="5"  y="9"  width="1" height="1" />
      <rect x="6"  y="10" width="1" height="1" />
      <rect x="7"  y="11" width="1" height="1" />
      <rect x="8"  y="12" width="1" height="1" />
      <rect x="9"  y="13" width="1" height="1" />
      <rect x="10" y="14" width="1" height="1" />
      <rect x="11" y="14" width="1" height="1" />
      {/* right diagonal: from (20,8) -> (12,14) */}
      <rect x="19" y="8"  width="1" height="1" />
      <rect x="18" y="9"  width="1" height="1" />
      <rect x="17" y="10" width="1" height="1" />
      <rect x="16" y="11" width="1" height="1" />
      <rect x="15" y="12" width="1" height="1" />
      <rect x="14" y="13" width="1" height="1" />
      <rect x="13" y="14" width="1" height="1" />
      <rect x="12" y="14" width="1" height="1" />
    </g>
  )
}

function OpenEnvelope() {
  // open: flap rotated outward (V points up), letter peeking up
  return (
    <>
      {/* letter peeking out (brown, behind envelope) */}
      <g fill="var(--ink-soft)">
        {/* triangular letter pointing up */}
        <rect x="11" y="3"  width="2" height="1" />
        <rect x="10" y="4"  width="4" height="1" />
        <rect x="9"  y="5"  width="6" height="1" />
        <rect x="8"  y="6"  width="8" height="1" />
        <rect x="7"  y="7"  width="10" height="1" />
        <rect x="6"  y="8"  width="12" height="1" />
        <rect x="5"  y="9"  width="14" height="1" />
        <rect x="5"  y="10" width="14" height="1" />
        <rect x="5"  y="11" width="14" height="1" />
        {/* letter base fills into envelope opening */}
        <rect x="5"  y="12" width="14" height="2" />
      </g>
      {/* envelope body (in front of letter base) */}
      <g fill="var(--ink)">
        {/* top edge of body */}
        <rect x="3"  y="11" width="18" height="1" />
        {/* bottom edge */}
        <rect x="3"  y="18" width="18" height="1" />
        {/* left edge */}
        <rect x="3"  y="11" width="1"  height="8" />
        {/* right edge */}
        <rect x="20" y="11" width="1"  height="8" />
        {/* open flap — diagonals pointing OUTWARD from top of body */}
        {/* left diagonal: (3,11) -> (11,3)... going up & inward */}
        <rect x="4"  y="10" width="1" height="1" />
        <rect x="5"  y="9"  width="1" height="1" />
        <rect x="6"  y="8"  width="1" height="1" />
        <rect x="7"  y="7"  width="1" height="1" />
        <rect x="8"  y="6"  width="1" height="1" />
        <rect x="9"  y="5"  width="1" height="1" />
        <rect x="10" y="4"  width="1" height="1" />
        <rect x="11" y="3"  width="1" height="1" />
        {/* right diagonal: (20,11) -> (12,3) */}
        <rect x="19" y="10" width="1" height="1" />
        <rect x="18" y="9"  width="1" height="1" />
        <rect x="17" y="8"  width="1" height="1" />
        <rect x="16" y="7"  width="1" height="1" />
        <rect x="15" y="6"  width="1" height="1" />
        <rect x="14" y="5"  width="1" height="1" />
        <rect x="13" y="4"  width="1" height="1" />
        <rect x="12" y="3"  width="1" height="1" />
      </g>
    </>
  )
}
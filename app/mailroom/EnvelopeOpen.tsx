'use client'
import { useEffect, useState } from 'react'

export default function EnvelopeOpen({
  onDone,
  durationMs = 1100,
}: {
  onDone?: () => void
  durationMs?: number
}) {
  const [phase, setPhase] = useState<'closed' | 'flap' | 'slide' | 'done'>('closed')

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('flap'),  60)
    const t2 = setTimeout(() => setPhase('slide'), Math.floor(durationMs * 0.45))
    const t3 = setTimeout(() => {
      setPhase('done')
      onDone?.()
    }, durationMs)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [durationMs, onDone])

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(42, 31, 18, 0.55)',
        pointerEvents: phase === 'done' ? 'none' : 'auto',
        opacity: phase === 'done' ? 0 : 1,
        transition: 'opacity 220ms ease',
      }}
    >
      <div className="envelope-stage">
        {/* the letter sheet that slides up out of the envelope */}
        <div className={`env-letter ${phase === 'slide' || phase === 'done' ? 'up' : ''}`}>
          <div className="env-letter-line" style={{ width: '70%' }} />
          <div className="env-letter-line" style={{ width: '85%' }} />
          <div className="env-letter-line" style={{ width: '60%' }} />
          <div className="env-letter-line" style={{ width: '80%' }} />
          <div className="env-letter-line" style={{ width: '50%' }} />
        </div>

        {/* envelope body */}
        <div className="env-body" />

        {/* envelope flap */}
        <div className={`env-flap ${phase === 'flap' || phase === 'slide' || phase === 'done' ? 'open' : ''}`} />

        {/* wax seal */}
        <div className={`env-seal ${phase !== 'closed' ? 'broken' : ''}`}>
          <div className="env-seal-dot" />
        </div>
      </div>

      <style jsx>{`
        .envelope-stage {
          position: relative;
          width: 192px;
          height: 144px;
          image-rendering: pixelated;
        }

        .env-body {
          position: absolute;
          left: 0; bottom: 0;
          width: 192px;
          height: 108px;
          background: var(--paper-2);
          border: 6px solid var(--ink);
          box-shadow:
            inset -6px -6px 0 0 rgba(42, 31, 18, 0.18),
            6px 6px 0 0 rgba(42, 31, 18, 0.35);
        }

        .env-flap {
          position: absolute;
          left: 0;
          top: 30px;
          width: 0;
          height: 0;
          border-left:  96px solid transparent;
          border-right: 96px solid transparent;
          border-top:   72px solid var(--ink);
          transform-origin: 50% 0%;
          transform: rotate(0deg);
          transition: transform 600ms steps(8, end);
          z-index: 3;
          filter: drop-shadow(0 0 0 var(--ink));
        }
        .env-flap.open {
          transform: rotate(180deg) translateY(2px);
        }

        .env-letter {
          position: absolute;
          left: 16px;
          bottom: 14px;
          width: 160px;
          height: 96px;
          background: var(--paper);
          border: 4px solid var(--ink);
          padding: 14px 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          transform: translateY(0);
          transition: transform 600ms steps(10, end);
          z-index: 2;
          box-shadow: 4px 4px 0 0 rgba(42, 31, 18, 0.25);
        }
        .env-letter.up {
          transform: translateY(-72px);
        }

        .env-letter-line {
          height: 6px;
          background: var(--ink);
          opacity: 0.75;
        }

        .env-seal {
          position: absolute;
          left: 50%;
          top: 78px;
          width: 28px;
          height: 28px;
          margin-left: -14px;
          background: var(--accent);
          border: 4px solid var(--ink);
          z-index: 4;
          transition: opacity 200ms ease, transform 200ms ease;
        }
        .env-seal-dot {
          position: absolute;
          left: 50%; top: 50%;
          width: 8px; height: 8px;
          margin: -4px 0 0 -4px;
          background: var(--ink);
        }
        .env-seal.broken {
          opacity: 0;
          transform: scale(0.6) rotate(-12deg);
        }
      `}</style>
    </div>
  )
}

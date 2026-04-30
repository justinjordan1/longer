'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

function format(ms: number): string {
  if (ms <= 0) return 'any moment'
  const s = Math.ceil(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rs = s % 60
  if (m < 60) return rs === 0 ? `${m}m` : `${m}m ${rs}s`
  const h = Math.floor(m / 60)
  const rm = m % 60
  return rm === 0 ? `${h}h` : `${h}h ${rm}m`
}

export default function LiveTimeUntil({
  iso,
  whenPassed,
  refreshOnExpire = false,
}: {
  iso: string
  whenPassed?: string
  refreshOnExpire?: boolean
}) {
  const router = useRouter()
  const target = new Date(iso).getTime()
  const [now, setNow] = useState(() => Date.now())
  const refreshedRef = useRef(false)

  useEffect(() => {
    const tick = () => setNow(Date.now())
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  // Once-only refresh when timer crosses zero
  useEffect(() => {
    if (!refreshOnExpire) return
    if (refreshedRef.current) return
    if (now < target) return
    refreshedRef.current = true
    // Small delay so any concurrent server-side state transitions have a moment
    const t = setTimeout(() => router.refresh(), 500)
    return () => clearTimeout(t)
  }, [now, target, refreshOnExpire, router])

  const diff = target - now
  if (diff <= 0 && whenPassed) return <>{whenPassed}</>
  return <>{format(diff)}</>
}

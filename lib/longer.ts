export const POST_MIN_WORDS = 300
export const COMMENT_MIN_WORDS = 40
export const LETTER_MIN_WORDS = 100

export const FLAG_PRESETS = [
  {
    value: 'difficult-considered',
    label: 'difficult · considered',
    note: 'difficult subject matter, but the discussion below is worth your time.',
  },
  {
    value: 'thread-derailed',
    label: 'thread off the rails',
    note: 'the post is fine; the response thread went somewhere unproductive.',
  },
  {
    value: 'correction-issued',
    label: 'correction in comments',
    note: 'a factual error in the essay was addressed in the responses.',
  },
] as const

export type FlagValue = typeof FLAG_PRESETS[number]['value']

export function flagByValue(v: string | null) {
  if (!v) return null
  return FLAG_PRESETS.find((f) => f.value === v) ?? null
}

// supabase embeds a joined profile as an object or a single-element array
// depending on how the relationship is inferred; normalize both shapes.
export type ProfileRelation = { handle: string } | { handle: string }[] | null

export function profileHandle(profile: ProfileRelation): string {
  if (Array.isArray(profile)) return profile[0]?.handle ?? '?'
  return profile?.handle ?? '?'
}

export function countWords(s: string): number {
  const t = s.trim()
  return t ? t.split(/\s+/).length : 0
}

export function timeAgo(iso: string | Date, now = new Date()): string {
  const ts = typeof iso === 'string' ? new Date(iso) : iso
  const d = now.getTime() - ts.getTime()
  if (d < 60_000)        return 'now'
  if (d < 3_600_000)     return `${Math.floor(d / 60_000)}m`
  if (d < 86_400_000)    return `${Math.floor(d / 3_600_000)}h`
  return `${Math.floor(d / 86_400_000)}d`
}

export function timeUntil(iso: string | Date, now = new Date()): string {
  const ts = typeof iso === 'string' ? new Date(iso) : iso
  const d = ts.getTime() - now.getTime()
  if (d <= 0)            return 'any moment'
  if (d < 60_000)        return `${Math.ceil(d / 1000)}s`
  if (d < 3_600_000)     return `${Math.ceil(d / 60_000)}m`
  if (d < 86_400_000)    return `${Math.ceil(d / 3_600_000)}h`
  return `${Math.ceil(d / 86_400_000)}d`
}

export function formatRemaining(ms: number): string | null {
  if (ms <= 0) return null
  const s = Math.ceil(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return s % 60 === 0 ? `${m}m` : `${m}m ${s % 60}s`
}

import crypto from 'node:crypto'

export const BETA_ACCESS_COOKIE = 'longer_beta_access'

const BETA_COOKIE_TTL_MS = 10 * 60 * 1000

function betaCodes() {
  return (process.env.LONGER_BETA_CODES ?? '')
    .split(',')
    .map((code) => code.trim())
    .filter(Boolean)
}

function betaCookieSecret() {
  return process.env.LONGER_BETA_COOKIE_SECRET ?? betaCodes().join(',')
}

function sign(value: string) {
  return crypto
    .createHmac('sha256', betaCookieSecret())
    .update(value)
    .digest('base64url')
}

export function isValidBetaCode(code: string) {
  const submitted = code.trim()
  if (!submitted) return false

  return betaCodes().some((validCode) => {
    const submittedBuffer = Buffer.from(submitted)
    const validBuffer = Buffer.from(validCode)

    if (submittedBuffer.length !== validBuffer.length) return false
    return crypto.timingSafeEqual(submittedBuffer, validBuffer)
  })
}

export function createBetaAccessCookie() {
  const expiresAt = Date.now() + BETA_COOKIE_TTL_MS
  const payload = `beta.${expiresAt}`
  return `${payload}.${sign(payload)}`
}

export function hasValidBetaAccessCookie(value: string | undefined) {
  if (!value || !betaCookieSecret()) return false

  const parts = value.split('.')
  if (parts.length !== 3) return false

  const [kind, expiresAt, signature] = parts
  if (kind !== 'beta') return false

  const expires = Number(expiresAt)
  if (!Number.isFinite(expires) || expires < Date.now()) return false

  const payload = `${kind}.${expiresAt}`
  const expected = sign(payload)
  const signatureBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)

  if (signatureBuffer.length !== expectedBuffer.length) return false
  return crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
}

export const betaAccessCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: BETA_COOKIE_TTL_MS / 1000,
}

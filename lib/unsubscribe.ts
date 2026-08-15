import { createHmac, timingSafeEqual } from 'node:crypto'

// Unsubscribe links have to work for someone who is not signed in, so the
// token carries the user id and proves it with an HMAC. Deriving the key from
// the service-role secret keeps this out of the profiles table, where a token
// column would be one grant mistake away from being world-readable.
const KEY_INFO = 'longer:letter-email-unsubscribe:v1'

function signingKey() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) return null
  return createHmac('sha256', secret).update(KEY_INFO).digest()
}

function b64url(buf: Buffer) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function createUnsubscribeToken(userId: string): string | null {
  const key = signingKey()
  if (!key) return null
  const sig = b64url(createHmac('sha256', key).update(userId).digest()).slice(0, 32)
  return `${userId}.${sig}`
}

export function verifyUnsubscribeToken(token: string | null | undefined): string | null {
  if (!token) return null
  const dot = token.lastIndexOf('.')
  if (dot <= 0) return null

  const userId = token.slice(0, dot)
  const expected = createUnsubscribeToken(userId)
  if (!expected) return null

  const a = Buffer.from(token)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  return userId
}

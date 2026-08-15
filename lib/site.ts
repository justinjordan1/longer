// Server actions have no request to read an origin off of, so absolute links
// in email come from here.
export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (configured) return configured.replace(/\/+$/, '')
  if (process.env.VERCEL_ENV === 'production') return 'https://longerwords.com'
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

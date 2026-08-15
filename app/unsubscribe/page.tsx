import Link from 'next/link'
import { verifyUnsubscribeToken } from '@/lib/unsubscribe'
import { unsubscribeFromLetterEmails } from './actions'

export const dynamic = 'force-dynamic'

// Nothing is changed by loading this page — link scanners prefetch GETs, and a
// prefetch should not unsubscribe anyone. The button below does the work.
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; done?: string; error?: string }>
}) {
  const params = await searchParams
  const token = params.t ?? ''
  const valid = Boolean(verifyUnsubscribeToken(token))
  const done = params.done === '1'

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '48px 20px' }}>
      <pre className="ascii muted" style={{ fontSize: 13, marginBottom: 18 }}>
{`┌─[ LETTER EMAILS ]───`}
      </pre>

      {done ? (
        <>
          <p style={{ fontSize: 15, marginBottom: 12 }}>
            done. we won&apos;t email you about new letters anymore.
          </p>
          <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
            letters still arrive in your mailroom — you just have to come look.
            you can turn emails back on at the bottom of the mailroom page.
          </p>
        </>
      ) : params.error === 'unavailable' || params.error === 'failed' ? (
        <p className="accent" style={{ fontSize: 14 }}>
          something went wrong on our end. try again in a minute, or turn emails off
          from the mailroom page.
        </p>
      ) : !valid ? (
        <>
          <p style={{ fontSize: 14, marginBottom: 12 }}>this unsubscribe link isn&apos;t valid.</p>
          <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
            it may have been cut short by your mail client. you can always turn letter
            emails off at the bottom of the mailroom page.
          </p>
        </>
      ) : (
        <>
          <p style={{ fontSize: 15, marginBottom: 18 }}>
            turn off emails about new letters?
          </p>
          <form action={unsubscribeFromLetterEmails}>
            <input type="hidden" name="t" value={token} />
            <button type="submit" className="btn">▸ TURN THEM OFF</button>
          </form>
          <p className="muted" style={{ fontSize: 12, marginTop: 14, lineHeight: 1.6 }}>
            this only stops the emails. your mailroom keeps working.
          </p>
        </>
      )}

      <p style={{ marginTop: 26 }}>
        <Link href="/" className="link" style={{ fontSize: 13 }}>← back to front page</Link>
      </p>
    </div>
  )
}

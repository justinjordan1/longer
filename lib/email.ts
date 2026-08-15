import { siteUrl } from './site'

const RESEND_ENDPOINT = 'https://api.resend.com/emails'
const DEFAULT_FROM = 'LONGER <letters@longerwords.com>'

type SendResult = { sent: boolean; skipped?: string; error?: string }

type LetterEmail = {
  to: string
  recipientHandle: string
  senderHandle: string
  title: string
  wordCount: number
  unsubscribeToken: string
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// The body of a letter never leaves the mailroom — the notification says a
// letter arrived and who it is from, and the reading happens on the site.
function renderLetterEmail(letter: LetterEmail, base: string, unsubscribeUrl: string) {
  const from = `@${letter.senderHandle}`
  const title = letter.title.trim()
  const subject = title
    ? `${from} sent you a letter: ${title}`
    : `${from} sent you a letter`

  const text = [
    `a letter arrived at your mailroom.`,
    ``,
    `from: ${from}`,
    title ? `subject: ${title}` : null,
    `length: ${letter.wordCount} words`,
    ``,
    `read it: ${base}/mailroom`,
    ``,
    `--`,
    `you're getting this because @${letter.recipientHandle} accepts letters on LONGER.`,
    `turn these emails off: ${unsubscribeUrl}`,
  ].filter(line => line !== null).join('\n')

  const html = `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#ece2c8;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">a letter from ${escapeHtml(from)} is waiting in your mailroom.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ece2c8;padding:28px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#e2d6b3;border:1px solid #b8a878;">
          <tr>
            <td style="padding:14px 18px;border-bottom:1px dashed #b8a878;font:700 12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;color:#4a3a25;">
              ┌─[ MAILROOM ]───
            </td>
          </tr>
          <tr>
            <td style="padding:22px 18px;font:400 15px/1.65 ui-monospace,SFMono-Regular,Menlo,monospace;color:#2a1f12;">
              <p style="margin:0 0 18px;">a letter arrived.</p>
              <p style="margin:0 0 6px;color:#8a7a5c;font-size:12.5px;">FROM</p>
              <p style="margin:0 0 16px;font-weight:700;"><span style="color:#8b2635;">@</span>${escapeHtml(letter.senderHandle)}</p>
              ${title ? `<p style="margin:0 0 6px;color:#8a7a5c;font-size:12.5px;">SUBJECT</p>
              <p style="margin:0 0 16px;">${escapeHtml(title)}</p>` : ''}
              <p style="margin:0 0 22px;color:#8a7a5c;font-size:12.5px;">${letter.wordCount} words · sealed until you open it</p>
              <a href="${base}/mailroom" style="display:inline-block;padding:9px 16px;background:#2a1f12;color:#ece2c8;text-decoration:none;font:700 13px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.06em;">▸ OPEN MAILROOM</a>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 18px;border-top:1px dashed #b8a878;font:400 11.5px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;color:#8a7a5c;">
              you're getting this because <span style="color:#8b2635;">@</span>${escapeHtml(letter.recipientHandle)} accepts letters on LONGER.<br />
              <a href="${unsubscribeUrl}" style="color:#8a7a5c;">turn off letter emails</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  return { subject, text, html }
}

export async function sendLetterNotification(letter: LetterEmail): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { sent: false, skipped: 'no RESEND_API_KEY' }
  if (!letter.to) return { sent: false, skipped: 'recipient has no email address' }

  const base = siteUrl()
  const unsubscribeUrl = `${base}/unsubscribe?t=${encodeURIComponent(letter.unsubscribeToken)}`
  const oneClickUrl = `${base}/api/letters/unsubscribe?t=${encodeURIComponent(letter.unsubscribeToken)}`
  const { subject, text, html } = renderLetterEmail(letter, base, unsubscribeUrl)

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.LETTER_EMAIL_FROM || DEFAULT_FROM,
        to: [letter.to],
        subject,
        text,
        html,
        headers: {
          'List-Unsubscribe': `<${oneClickUrl}>, <${unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      }),
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) {
      return { sent: false, error: `resend ${res.status}: ${(await res.text()).slice(0, 200)}` }
    }
    return { sent: true }
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : 'unknown send failure' }
  }
}

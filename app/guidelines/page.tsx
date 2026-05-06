import Link from 'next/link'

export const metadata = {
  title: 'Guidelines · LONGER',
}

export default function GuidelinesPage() {
  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: '24px 20px' }}>
      <Link href="/" className="link" style={{ fontSize: 13, marginBottom: 18, display: 'inline-block' }}>
        ← back to front page
      </Link>

      <div className="panel">
        <div className="panel-header">
          <span>┌── GUIDELINES ──┐</span>
        </div>
        <div className="panel-body" style={{ padding: 28, fontSize: 14, lineHeight: 1.75 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 0, marginBottom: 10 }}>
            Be empathetic
          </h2>
          <p style={{ marginTop: 0 }}>
            There is bigotry of the obvious kind. Overt racism, sexism, clear delineations separating one&apos;s tribe from the &quot;other.&quot; This is clearly terrible. However, there is a pressing and in some ways more insidious form of bigotry, and that is silent forms of patronization. Statements, say, about the &quot;average Rural American,&quot; an imagined strawman removed from their context. Empathy not only across race or gender but across class and circumstance is necessary for genuine discussion.
          </p>

          <div style={{ borderTop: '1px dashed var(--rule)', margin: '28px 0' }} />

          <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 0, marginBottom: 10 }}>
            Comment in good faith
          </h2>

          <div style={{ borderTop: '1px dashed var(--rule)', margin: '28px 0' }} />

          <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 0, marginBottom: 10 }}>
            No slop, please
          </h2>
          <p style={{ marginTop: 0, marginBottom: 0 }}>
            Really hard to enforce but cmon yall. AI detectors are mathematically useless, so don&apos;t rely on them, but if you believe something to be AI you can report it as such (and the # of flags will be visible on the post). Moderation will probably not remove the post, as even slop can create good discussion in the comments, but if it&apos;s especially egregious it will be taken down.
          </p>

          <div style={{ borderTop: '1px dashed var(--rule)', margin: '28px 0' }} />

          <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 0, marginBottom: 10 }}>
            Write whatever
          </h2>
          <p style={{ marginTop: 0, marginBottom: 0 }}>
            Short stories, essays, poems, book reviews, rants about life, rants about a theoretical life, plans, failures, or whatever else is on the dome.
          </p>
        </div>
      </div>
    </main>
  )
}

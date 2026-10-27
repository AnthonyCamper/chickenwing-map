import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import PageStateShell from '../components/ui/PageStateShell'

export default function NotFound() {
  return (
    <PageStateShell>
      <Helmet>
        <title>Page not found — WingKingTony</title>
      </Helmet>
      <p className="eyebrow">404</p>
      <h1 className="font-display uppercase text-3xl text-night-900">Nothing on this bone</h1>
      <p className="text-sm text-charcoal-600 max-w-xs leading-relaxed">
        We couldn't find that page. The link may be wrong, or the page was deleted.
      </p>
      <Link to="/" className="btn-secondary">Go to the home page</Link>
    </PageStateShell>
  )
}

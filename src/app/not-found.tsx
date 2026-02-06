import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="not-found">
      <div className="card not-found-card">
        <div className="not-found-title">Page not found</div>
        <div className="not-found-text">The page you’re looking for doesn’t exist or moved.</div>
        <div className="not-found-actions">
          <Link className="btn btn-primary btn-inline" href="/">
            Go home
          </Link>
          <Link className="btn btn-secondary btn-inline" href="/login">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  )
}


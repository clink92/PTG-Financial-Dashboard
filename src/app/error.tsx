'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="not-found">
      <div className="card not-found-card">
        <div className="not-found-title">Something went wrong</div>
        <div className="not-found-text">{error.message || 'Unexpected error'}</div>
        <div className="not-found-actions">
          <button className="btn btn-primary btn-inline" onClick={() => reset()}>
            Try again
          </button>
          <a className="btn btn-secondary btn-inline" href="/login">
            Sign in
          </a>
        </div>
      </div>
    </div>
  )
}


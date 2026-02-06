'use client'

import { useState, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'

function safeCallbackPath(raw: string | null): string {
  if (!raw) return '/dashboard'
  // Only allow same-site relative paths to avoid open redirects and host/port mismatches.
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw
  return '/dashboard'
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackPath = safeCallbackPath(searchParams.get('callbackUrl'))
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const absoluteCallbackUrl =
        typeof window !== 'undefined' ? new URL(callbackPath, window.location.origin).toString() : callbackPath
      const result = await signIn('credentials', {
        email,
        password,
        callbackUrl: absoluteCallbackUrl,
        redirect: false,
      })

      if (result?.error) {
        setError(result.error)
      } else {
        router.push(callbackPath)
        router.refresh()
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleDemoLogin = async (role: 'admin' | 'manager' | 'viewer') => {
    const credentials = {
      admin: { email: 'admin@ptgfinancial.com', password: 'PJM315g!' },
      manager: { email: 'manager@ptgfinancial.com', password: 'PJM315g!' },
      viewer: { email: 'viewer@ptgfinancial.com', password: 'PJM315g!' },
    }

    setEmail(credentials[role].email)
    setPassword(credentials[role].password)
    setLoading(true)

    const absoluteCallbackUrl =
      typeof window !== 'undefined' ? new URL(callbackPath, window.location.origin).toString() : callbackPath
    const result = await signIn('credentials', {
      email: credentials[role].email,
      password: credentials[role].password,
      callbackUrl: absoluteCallbackUrl,
      redirect: false,
    })

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    } else {
      router.push(callbackPath)
      router.refresh()
    }
  }

  return (
    <div className="login-card">
      <div className="login-header">
        <div className="login-logo">
          <i className="fas fa-building"></i>
        </div>
        <h1 className="login-title">Park Terrace Gardens</h1>
        <p className="login-subtitle">Financial Dashboard Login</p>
      </div>

      {error && (
        <div className="error-message">
          <i className="fas fa-exclamation-circle" style={{ marginRight: 8 }}></i>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="email">
            Email Address
          </label>
          <input
            id="email"
            type="email"
            className="form-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            className="form-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
          />
        </div>

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? (
            <>
              <span className="spinner" style={{ width: 16, height: 16 }}></span>
              Signing in...
            </>
          ) : (
            <>
              <i className="fas fa-sign-in-alt"></i>
              Sign In
            </>
          )}
        </button>
      </form>

      <div className="demo-credentials">
        <p><strong>Demo Accounts</strong> - Click to auto-login:</p>
        <div className="demo-buttons">
          <button 
            onClick={() => handleDemoLogin('admin')} 
            className="btn btn-secondary btn-sm"
            disabled={loading}
          >
            <i className="fas fa-user-shield"></i> Admin
          </button>
          <button 
            onClick={() => handleDemoLogin('manager')} 
            className="btn btn-secondary btn-sm"
            disabled={loading}
          >
            <i className="fas fa-user-tie"></i> Manager
          </button>
          <button 
            onClick={() => handleDemoLogin('viewer')} 
            className="btn btn-secondary btn-sm"
            disabled={loading}
          >
            <i className="fas fa-user"></i> Viewer
          </button>
        </div>
      </div>

      <div style={{ marginTop: 24, textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
        <i className="fas fa-shield-alt" style={{ marginRight: 4 }}></i>
        Secured with enterprise-grade encryption
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="login-container">
      <Suspense fallback={
        <div className="login-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
          <div className="spinner" style={{ width: 40, height: 40 }}></div>
        </div>
      }>
        <LoginForm />
      </Suspense>
    </div>
  )
}

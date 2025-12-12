'use client'

import { useState, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError(result.error)
      } else {
        router.push(callbackUrl)
        router.refresh()
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleDemoLogin = async (role: 'admin' | 'manager' | 'viewer') => {
    const credentials = {
      admin: { email: 'admin@ptgfinancial.com', password: 'admin123' },
      manager: { email: 'manager@ptgfinancial.com', password: 'manager123' },
      viewer: { email: 'viewer@ptgfinancial.com', password: 'viewer123' },
    }

    setEmail(credentials[role].email)
    setPassword(credentials[role].password)
    setLoading(true)

    const result = await signIn('credentials', {
      email: credentials[role].email,
      password: credentials[role].password,
      redirect: false,
    })

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    } else {
      router.push(callbackUrl)
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
        <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'center' }}>
          <button 
            onClick={() => handleDemoLogin('admin')} 
            className="btn btn-secondary"
            style={{ padding: '8px 12px', fontSize: 12 }}
            disabled={loading}
          >
            <i className="fas fa-user-shield"></i> Admin
          </button>
          <button 
            onClick={() => handleDemoLogin('manager')} 
            className="btn btn-secondary"
            style={{ padding: '8px 12px', fontSize: 12 }}
            disabled={loading}
          >
            <i className="fas fa-user-tie"></i> Manager
          </button>
          <button 
            onClick={() => handleDemoLogin('viewer')} 
            className="btn btn-secondary"
            style={{ padding: '8px 12px', fontSize: 12 }}
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

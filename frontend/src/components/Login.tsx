"use client"

import type React from "react"
import { useState, type FormEvent, type ChangeEvent } from "react"
import "./Login.css"

interface LoginProps {
  onLoginSuccess: (tenantId: string) => void
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [tenantId, setTenantId] = useState<string>("")
  const [password, setPassword] = useState<string>("")
  const [error, setError] = useState<string>("")
  const [loading, setLoading] = useState<boolean>(false)

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const response = await fetch("http://localhost:5001/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: tenantId, password }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Login failed")
      }

      const data = await response.json()
      localStorage.setItem("tenant_id", data.tenant_id)
      localStorage.setItem("tenant_name", data.name)
      onLoginSuccess(data.tenant_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="obs-login-container">
      <div className="obs-login-glow" />
      <div className="obs-login-box">
        <div className="obs-login-logo">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="8" fill="url(#gradient)" />
            <path d="M12 20L18 26L28 14" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <defs>
              <linearGradient id="gradient" x1="0" y1="0" x2="40" y2="40">
                <stop stopColor="#8B5CF6" />
                <stop offset="1" stopColor="#6366F1" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <h1 className="obs-login-title">Observability Platform</h1>
        <p className="obs-login-subtitle">Sign in to your dashboard</p>

        <form onSubmit={handleLogin} className="obs-login-form">
          <div className="obs-form-group">
            <label htmlFor="tenantId">Tenant ID</label>
            <input
              type="text"
              id="tenantId"
              value={tenantId}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setTenantId(e.target.value)}
              placeholder="acme-corp"
              required
              disabled={loading}
            />
          </div>

          <div className="obs-form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={loading}
            />
          </div>

          {error && <div className="obs-error-message">{error}</div>}

          <button type="submit" className="obs-login-button" disabled={loading}>
            {loading ? <span className="obs-loading-spinner" /> : "Sign in"}
          </button>
        </form>

        <div className="obs-demo-credentials">
          <p className="obs-demo-title">Demo credentials</p>
          <div className="obs-demo-items">
            <code>acme-corp / acme123</code>
            <code>beta-inc / beta456</code>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login

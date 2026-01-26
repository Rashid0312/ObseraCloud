import React, { useState } from 'react';
import { API_BASE_URL } from '../config';
import { EyeLogo } from './EyeLogo';
import './Auth.css';

interface LoginProps {
  onLoginSuccess: (data: any) => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [isSignup, setIsSignup] = useState(false);
  const [tenantId, setTenantId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isSignup ? '/api/auth/register' : '/api/auth/login';
      const body = isSignup
        ? { tenant_id: tenantId, email, password, company_name: companyName }
        : { tenant_id: tenantId, password };

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Authentication failed');
        setLoading(false);
        return;
      }

      const authData = {
        token: data.token,
        tenant_id: data.tenant_id,
        company_name: data.company_name || data.name,
        api_key: data.api_key
      };

      localStorage.setItem('token', authData.token);
      localStorage.setItem('tenant_id', authData.tenant_id);
      localStorage.setItem('tenant_name', authData.company_name);
      localStorage.setItem('api_key', authData.api_key);

      onLoginSuccess(authData);
    } catch (err) {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      {/* Animated gradient orbs - handled by CSS ::before and ::after */}

      <div className="auth-card">
        {/* Header */}
        <div className="auth-header">
          <EyeLogo variant="light" width={80} height={80} className="auth-logo-icon" />
          <h1>ObseraCloud</h1>
          <p>Multi-Tenant Observability Platform</p>
        </div>

        {/* Tabs */}
        <div className="auth-tabs">
          <button
            className={!isSignup ? 'active' : ''}
            onClick={() => setIsSignup(false)}
          >
            Login
          </button>
          <button
            className={isSignup ? 'active' : ''}
            onClick={() => setIsSignup(true)}
          >
            Sign Up
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="auth-form">
          {isSignup && (
            <div className="form-group">
              <label>Company Name</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Acme Corp"
                required={isSignup}
              />
            </div>
          )}

          <div className="form-group">
            <label>Tenant ID</label>
            <input
              type="text"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              placeholder="acme"
              required
            />
          </div>

          {isSignup && (
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@company.com"
                required={isSignup}
              />
            </div>
          )}

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
            />
          </div>

          {error && (
            <div className="auth-error">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="auth-submit"
          >
            {loading && <div className="loading-spinner" />}
            {loading ? 'Loading...' : (isSignup ? 'Create Account' : 'Login')}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;

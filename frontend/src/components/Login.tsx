import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Login.css';

interface LoginResponse {
  tenant_id: string;
}

function Login() {
  const [apiKey, setApiKey] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const navigate = useNavigate();

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post<LoginResponse>('http://localhost:5001/api/auth/login', {
        api_key: apiKey
      });

      localStorage.setItem('tenantId', response.data.tenant_id);
      localStorage.setItem('apiKey', apiKey);
      navigate('/dashboard');
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Login failed');
      } else {
        setError('Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>🚀 SkyView</h1>
          <p>Multi-Tenant Observability Platform</p>
        </div>
        
        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label>API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your API key"
              required
              disabled={loading}
            />
          </div>
          
          {error && <div className="error-message">{error}</div>}
          
          <button type="submit" disabled={loading} className="login-btn">
            {loading ? 'Authenticating...' : 'Login'}
          </button>
        </form>

        <div className="demo-keys">
          <p className="demo-title">Demo Keys:</p>
          <code>tenant1-secret-key-12345</code>
          <code>tenant2-secret-key-67890</code>
        </div>
      </div>
    </div>
  );
}

export default Login;

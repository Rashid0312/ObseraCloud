import { useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import DemoPage from './components/DemoPage';
import PublicStatusPage from './components/PublicStatusPage';
import { ThemeProvider } from './contexts/ThemeContext';
import './index.css';

// Session timeout in milliseconds (30 minutes)
const SESSION_TIMEOUT = 30 * 60 * 1000;

// Protected Route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  const isSessionValid = useCallback(() => {
    const tenantId = localStorage.getItem('tenant_id');
    const lastActivity = localStorage.getItem('last_activity');

    if (!tenantId || !lastActivity) return false;

    const lastActivityTime = parseInt(lastActivity, 10);
    const now = Date.now();

    if (now - lastActivityTime > SESSION_TIMEOUT) {
      localStorage.removeItem('tenant_id');
      localStorage.removeItem('tenant_name');
      localStorage.removeItem('token');
      localStorage.removeItem('api_key');
      localStorage.removeItem('last_activity');
      return false;
    }

    return true;
  }, []);

  useEffect(() => {
    if (!isSessionValid()) {
      navigate('/login');
    }
  }, [isSessionValid, navigate]);

  // Update activity on user interaction
  useEffect(() => {
    const updateActivity = () => {
      if (localStorage.getItem('tenant_id')) {
        localStorage.setItem('last_activity', Date.now().toString());
      }
    };

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, updateActivity));

    const intervalId = setInterval(() => {
      if (!isSessionValid()) {
        navigate('/login');
      }
    }, 60000);

    return () => {
      events.forEach(event => window.removeEventListener(event, updateActivity));
      clearInterval(intervalId);
    };
  }, [isSessionValid, navigate]);

  return isSessionValid() ? <>{children}</> : null;
}

// Login wrapper that redirects if already logged in
function LoginRoute() {
  const navigate = useNavigate();

  const handleLoginSuccess = () => {
    localStorage.setItem('last_activity', Date.now().toString());
    navigate('/dashboard');
  };

  // Check if already logged in
  useEffect(() => {
    const tenantId = localStorage.getItem('tenant_id');
    const lastActivity = localStorage.getItem('last_activity');
    if (tenantId && lastActivity) {
      const lastActivityTime = parseInt(lastActivity, 10);
      if (Date.now() - lastActivityTime < SESSION_TIMEOUT) {
        navigate('/dashboard');
      }
    }
  }, [navigate]);

  return <Login onLoginSuccess={handleLoginSuccess} />;
}

// Landing page wrapper
function LandingRoute() {
  const navigate = useNavigate();
  return <LandingPage onGetStarted={() => navigate('/login')} />;
}

// Dashboard wrapper
function DashboardRoute() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('tenant_id');
    localStorage.removeItem('tenant_name');
    localStorage.removeItem('token');
    localStorage.removeItem('api_key');
    localStorage.removeItem('last_activity');
    navigate('/login');
  };

  const handleGoHome = () => {
    navigate('/landing');
  };

  return <Dashboard onLogout={handleLogout} onGoHome={handleGoHome} />;
}

// Redirect helper for root path
function RootRedirect() {
  const tenantId = localStorage.getItem('tenant_id');
  const lastActivity = localStorage.getItem('last_activity');

  if (tenantId && lastActivity) {
    const lastActivityTime = parseInt(lastActivity, 10);
    if (Date.now() - lastActivityTime < SESSION_TIMEOUT) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <LandingRoute />;
}

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          {/* Landing page at root */}
          <Route path="/" element={<RootRedirect />} />

          {/* Explicit landing page route */}
          <Route path="/landing" element={<LandingRoute />} />

          {/* Login page */}
          <Route path="/login" element={<LoginRoute />} />

          {/* Protected dashboard */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardRoute />
              </ProtectedRoute>
            }
          />

          {/* Public status pages */}
          <Route path="/status/:slug" element={<PublicStatusPage />} />

          {/* Demo Page */}
          <Route path="/demo" element={<DemoPage />} />

          {/* Catch-all redirect to landing */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;

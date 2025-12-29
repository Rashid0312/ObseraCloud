import { useState, useEffect, useCallback } from 'react';
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import { ThemeProvider } from './contexts/ThemeContext';
import './index.css';

type View = 'landing' | 'login' | 'dashboard';

// Session timeout in milliseconds (30 minutes)
const SESSION_TIMEOUT = 30 * 60 * 1000;

function App() {
  const [currentView, setCurrentView] = useState<View>('landing');

  // Check if session is still valid
  const isSessionValid = useCallback(() => {
    const tenantId = localStorage.getItem('tenant_id');
    const lastActivity = localStorage.getItem('last_activity');

    if (!tenantId || !lastActivity) return false;

    const lastActivityTime = parseInt(lastActivity, 10);
    const now = Date.now();

    // Session expired if inactive for too long
    if (now - lastActivityTime > SESSION_TIMEOUT) {
      // Clear expired session
      localStorage.removeItem('tenant_id');
      localStorage.removeItem('tenant_name');
      localStorage.removeItem('token');
      localStorage.removeItem('api_key');
      localStorage.removeItem('last_activity');
      return false;
    }

    return true;
  }, []);

  // Update activity timestamp
  const updateActivity = useCallback(() => {
    if (localStorage.getItem('tenant_id')) {
      localStorage.setItem('last_activity', Date.now().toString());
    }
  }, []);

  useEffect(() => {
    // Check if user has valid session on load
    if (isSessionValid()) {
      updateActivity();
      setCurrentView('dashboard');
    }
  }, [isSessionValid, updateActivity]);

  // Track user activity to extend session
  useEffect(() => {
    if (currentView !== 'dashboard') return;

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];

    const handleActivity = () => {
      updateActivity();
    };

    events.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    // Check session validity periodically
    const intervalId = setInterval(() => {
      if (!isSessionValid()) {
        setCurrentView('login');
      }
    }, 60000); // Check every minute

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      clearInterval(intervalId);
    };
  }, [currentView, isSessionValid, updateActivity]);

  const handleGetStarted = () => {
    setCurrentView('login');
  };

  const handleLoginSuccess = () => {
    localStorage.setItem('last_activity', Date.now().toString());
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('tenant_id');
    localStorage.removeItem('tenant_name');
    localStorage.removeItem('token');
    localStorage.removeItem('api_key');
    localStorage.removeItem('last_activity');
    setCurrentView('login');
  };

  return (
    <ThemeProvider>
      {currentView === 'landing' && (
        <LandingPage onGetStarted={handleGetStarted} />
      )}
      {currentView === 'login' && (
        <Login onLoginSuccess={handleLoginSuccess} />
      )}
      {currentView === 'dashboard' && (
        <Dashboard onLogout={handleLogout} onGoHome={() => setCurrentView('login')} />
      )}
    </ThemeProvider>
  );
}

export default App;

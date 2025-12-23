import { useState, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import { ThemeProvider } from './contexts/ThemeContext';
import './index.css';

type View = 'landing' | 'login' | 'dashboard';

function App() {
  const [currentView, setCurrentView] = useState<View>('landing');

  useEffect(() => {
    // Check if user is already logged in - persist session
    const tenantId = localStorage.getItem('tenant_id');
    if (tenantId) {
      setCurrentView('dashboard');
    }
  }, []);

  const handleGetStarted = () => {
    setCurrentView('login');
  };

  const handleLoginSuccess = () => {
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('tenant_id');
    localStorage.removeItem('tenant_name');
    localStorage.removeItem('token');
    localStorage.removeItem('api_key');
    setCurrentView('landing');
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
        <Dashboard onLogout={handleLogout} onGoHome={() => setCurrentView('landing')} />
      )}
    </ThemeProvider>
  );
}

export default App;

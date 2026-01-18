import { useState, useEffect } from 'react';
import LogsPanel from './LogsPanel';
import MetricsChart from './MetricsChart';
import UptimeMonitors from './UptimeMonitors';
import StatusPages from './StatusPages';
import TracesPanel from './TracesPanel';
import IntegrationPanel from './IntegrationPanel';
import AdminPanel from './AdminPanel';
import SettingsPanel from './SettingsPanel';
import Sidebar from './Sidebar';
import { useTheme } from '../contexts/ThemeContext';
import { API_BASE_URL } from '../config';
import {
  List,
  GitBranch,
  Sun,
  Moon,
  RefreshCw,
  LogOut,
  AlertCircle,
  TrendingUp
} from 'lucide-react';
import './Dashboard.css';

interface Stats {
  totalLogs: number;
  errorCount: number;
  errorRate: number;
  avgResponseTime: number;
  activeTraces: number;
}

interface DashboardProps {
  onLogout?: () => void;
  onGoHome?: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onLogout, onGoHome }) => {
  const [tenantId, setTenantId] = useState<string>('');
  const [tenantName, setTenantName] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>('');
  const [token, setToken] = useState<string>('');
  const [activeView, setActiveView] = useState('overview');
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [highlightedTraceId, setHighlightedTraceId] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({ totalLogs: 0, errorCount: 0, errorRate: 0, avgResponseTime: 0, activeTraces: 0 });
  const { theme, toggleTheme } = useTheme();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const isAdmin = tenantId === 'admin';

  // Handler for navigating from logs to traces to highlight specific trace
  const handleNavigateToTrace = (traceId: string) => {
    setHighlightedTraceId(traceId);
    setActiveView('traces');
  };

  // Close sidebar on route change (mobile)
  useEffect(() => {
    if (window.innerWidth <= 768) {
      setIsSidebarOpen(false);
    }
  }, [activeView]);

  useEffect(() => {
    const storedTenantId = localStorage.getItem('tenant_id');
    const storedTenantName = localStorage.getItem('tenant_name');
    const storedApiKey = localStorage.getItem('api_key');
    const storedToken = localStorage.getItem('token');
    if (storedTenantId) setTenantId(storedTenantId);
    if (storedTenantName) setTenantName(storedTenantName);
    if (storedApiKey) setApiKey(storedApiKey);
    if (storedToken) setToken(storedToken);
  }, []);

  useEffect(() => {
    if (!tenantId || !token) return;

    const fetchStats = async () => {
      try {
        const headers: HeadersInit = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const [logsRes, metricsRes, tracesRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/logs?tenant_id=${tenantId}&limit=100`, { headers }),
          fetch(`${API_BASE_URL}/api/metrics?tenant_id=${tenantId}`, { headers }),
          fetch(`${API_BASE_URL}/api/traces?tenant_id=${tenantId}`, { headers })
        ]);

        const logsData = await logsRes.json();
        const metricsData = await metricsRes.json();
        const tracesData = await tracesRes.json();

        const logs = logsData.logs || [];
        const errorLogs = logs.filter((l: any) => l.level?.toLowerCase() === 'error');

        // Calculate average response time from trace durations
        const traces = tracesData.traces || [];
        let avgResponseTime = 0;
        if (traces.length > 0) {
          const totalDuration = traces.reduce((sum: number, t: any) => {
            // Duration is in nanoseconds, convert to milliseconds
            const durationMs = (t.Duration || 0) / 1_000_000;
            return sum + durationMs;
          }, 0);
          avgResponseTime = totalDuration / traces.length;
        }

        setStats({
          totalLogs: logs.length,
          errorCount: errorLogs.length,
          errorRate: logs.length > 0 ? (errorLogs.length / logs.length * 100) : 0,
          avgResponseTime: avgResponseTime,
          activeTraces: tracesData.count || 0
        });
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Auto-refresh every 30s
    return () => clearInterval(interval);
  }, [tenantId, refreshKey, token]);

  const handleLogout = () => {
    localStorage.removeItem('tenant_id');
    localStorage.removeItem('tenant_name');
    if (onLogout) {
      onLogout();
    } else {
      window.location.reload();
    }
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="dashboard-container">
      {/* Background Effects */}
      <div className="dashboard-bg-gradient" />
      <div className="dashboard-bg-orb dashboard-bg-orb-1" />
      <div className="dashboard-bg-orb dashboard-bg-orb-2" />

      {/* New Sidebar Component */}
      <div className={`dashboard-sidebar-wrapper ${isSidebarOpen ? 'open' : ''}`}>
        <Sidebar
          tenantName={tenantName}
          activeView={activeView}
          setActiveView={setActiveView}
          onGoHome={onGoHome || (() => { })}
          isAdmin={isAdmin}
          onClose={() => setIsSidebarOpen(false)}
        />
        <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)} />
      </div>

      {/* Main Content */}
      <main className="dashboard-main">
        {/* Header */}
        <header className="dashboard-header glass-panel">
          <div className="dashboard-header-left">
            <button
              className="dashboard-menu-btn"
              onClick={() => setIsSidebarOpen(true)}
            >
              <List size={24} />
            </button>
            <h1 className="dashboard-page-title">
              {activeView === 'overview' && 'Dashboard'}
              {activeView === 'logs' && 'Logs'}
              {activeView === 'metrics' && 'Metrics'}
              {activeView === 'traces' && 'Traces'}
              {activeView === 'uptime' && 'Uptime Monitors'}
              {activeView === 'status-pages' && 'Status Pages'}
              {activeView === 'integration' && 'Integration'}
              {activeView === 'settings' && 'Settings'}
              {activeView === 'admin' && 'Platform Admin'}
            </h1>
          </div>

          <div className="dashboard-header-actions">
            <button
              onClick={toggleTheme}
              className="dashboard-icon-btn"
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? <Sun className="dashboard-btn-icon" /> : <Moon className="dashboard-btn-icon" />}
            </button>
            <button onClick={handleRefresh} className="dashboard-action-btn">
              <RefreshCw className="dashboard-btn-icon" />
              Refresh
            </button>
            <button onClick={handleLogout} className="dashboard-action-btn danger">
              <LogOut className="dashboard-btn-icon" />
              Logout
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="dashboard-content">
          {activeView === 'overview' && (
            <div className="dashboard-overview">
              {/* Stats Grid */}
              <div className="dashboard-stats-grid">
                <div className="dashboard-stat-card glass-panel">
                  <div className="dashboard-stat-icon logs">
                    <List className="dashboard-stat-svg" />
                  </div>
                  <div className="dashboard-stat-info">
                    <span className="dashboard-stat-value">{stats.totalLogs}</span>
                    <span className="dashboard-stat-label">Total Logs</span>
                  </div>
                </div>

                <div className="dashboard-stat-card error glass-panel">
                  <div className="dashboard-stat-icon error">
                    <AlertCircle className="dashboard-stat-svg" />
                  </div>
                  <div className="dashboard-stat-info">
                    <span className="dashboard-stat-value">{stats.errorRate.toFixed(1)}%</span>
                    <span className="dashboard-stat-label">Error Rate</span>
                    <span className="dashboard-stat-sub">{stats.errorCount} errors</span>
                  </div>
                </div>

                <div className="dashboard-stat-card glass-panel">
                  <div className="dashboard-stat-icon success">
                    <TrendingUp className="dashboard-stat-svg" />
                  </div>
                  <div className="dashboard-stat-info">
                    <span className="dashboard-stat-value">
                      {stats.avgResponseTime.toFixed(0)}<small>ms</small>
                    </span>
                    <span className="dashboard-stat-label">Avg Response</span>
                  </div>
                </div>

                <div className="dashboard-stat-card glass-panel">
                  <div className="dashboard-stat-icon traces">
                    <GitBranch className="dashboard-stat-svg" />
                  </div>
                  <div className="dashboard-stat-info">
                    <span className="dashboard-stat-value">{stats.activeTraces}</span>
                    <span className="dashboard-stat-label">Active Traces</span>
                  </div>
                </div>
              </div>

              {/* Overview Panels */}
              <div className="dashboard-panels-grid">
                <div className="dashboard-panel glass-panel">
                  <h3 className="dashboard-panel-title">Recent Logs</h3>
                  <LogsPanel tenantId={tenantId} refreshKey={refreshKey} compact onNavigateToTrace={handleNavigateToTrace} />
                </div>
                <div className="dashboard-panel glass-panel">
                  <h3 className="dashboard-panel-title">Metrics</h3>
                  <MetricsChart tenantId={tenantId} refreshKey={refreshKey} />
                </div>
              </div>
            </div>
          )}

          {activeView === 'uptime' && (
            <div className="dashboard-content fade-in">
              <UptimeMonitors tenantId={tenantId} refreshKey={refreshKey} />
            </div>
          )}

          {activeView === 'status-pages' && (
            <div className="dashboard-content fade-in">
              <StatusPages tenantId={tenantId} />
            </div>
          )}

          {activeView === 'logs' && (
            <LogsPanel tenantId={tenantId} refreshKey={refreshKey} onNavigateToTrace={handleNavigateToTrace} />
          )}
          {activeView === 'metrics' && (
            <MetricsChart tenantId={tenantId} refreshKey={refreshKey} />
          )}
          {activeView === 'traces' && (
            <TracesPanel tenantId={tenantId} refreshKey={refreshKey} highlightedTraceId={highlightedTraceId} />
          )}
          {activeView === 'integration' && (
            <IntegrationPanel apiKey={apiKey} tenantId={tenantId} />
          )}
          {activeView === 'settings' && (
            <SettingsPanel token={token} onApiKeyChange={(newKey) => setApiKey(newKey)} />
          )}
          {activeView === 'admin' && isAdmin && (
            <AdminPanel token={token} />
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;

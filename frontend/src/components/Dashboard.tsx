import { useState, useEffect } from 'react';
import LogsPanel from './LogsPanel';
import MetricsChart from './MetricsChart';
import TracesPanel from './TracesPanel';
import IntegrationPanel from './IntegrationPanel';
import AdminPanel from './AdminPanel';
import SettingsPanel from './SettingsPanel';
import { useTheme } from '../contexts/ThemeContext';
import { API_BASE_URL } from '../config';
import {
  Activity,
  LayoutGrid,
  Bell,
  Sun,
  Moon,
  RefreshCw,
  LogOut,
  List,
  BarChart3,
  GitBranch,
  ChevronRight,
  AlertCircle,
  TrendingUp,
  Zap,
  Key,
  Shield,
  Settings
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
  const [activeView, setActiveView] = useState<'overview' | 'logs' | 'metrics' | 'traces' | 'integration' | 'settings' | 'admin'>('overview');
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['telemetry']);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [highlightedTraceId, setHighlightedTraceId] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({ totalLogs: 0, errorCount: 0, errorRate: 0, avgResponseTime: 0, activeTraces: 0 });
  const { theme, toggleTheme } = useTheme();

  const isAdmin = tenantId === 'admin';

  // Handler for navigating from logs to traces
  const handleNavigateToTrace = (traceId: string) => {
    setHighlightedTraceId(traceId);
    setActiveView('traces');
  };

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
    if (!tenantId) return;

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
        const metrics = metricsData.metrics || [];

        // Calculate total requests from http_requests_total metric
        const requestMetrics = metrics.filter((m: any) => m.metric_name === 'http_requests_total');
        const totalRequests = requestMetrics.reduce((sum: number, m: any) => sum + parseFloat(m.value || 0), 0);

        setStats({
          totalLogs: logs.length,
          errorCount: errorLogs.length,
          errorRate: logs.length > 0 ? (errorLogs.length / logs.length * 100) : 0,
          avgResponseTime: 0, // Will be calculated from duration metrics when available
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

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev =>
      prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]
    );
  };

  const telemetryItems = [
    { id: 'logs', label: 'Logs', icon: List },
    { id: 'metrics', label: 'Metrics', icon: BarChart3 },
    { id: 'traces', label: 'Traces', icon: GitBranch },
  ];

  return (
    <div className="dashboard-container">
      {/* Background Effects */}
      <div className="dashboard-bg-gradient" />
      <div className="dashboard-bg-orb dashboard-bg-orb-1" />
      <div className="dashboard-bg-orb dashboard-bg-orb-2" />

      {/* Sidebar */}
      <aside className="dashboard-sidebar">
        {/* Logo */}
        <div className="dashboard-sidebar-header" onClick={onGoHome} style={{ cursor: 'pointer' }}>
          <Activity className="dashboard-logo-icon" />
          <span className="dashboard-logo-text">SkyView</span>
        </div>

        {/* Navigation */}
        <nav className="dashboard-nav">
          {/* Overview */}
          <button
            className={`dashboard-nav-item ${activeView === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveView('overview')}
          >
            <LayoutGrid className="dashboard-nav-icon" />
            <span>Dashboard</span>
          </button>

          {/* Telemetry Group */}
          <div className="dashboard-nav-group">
            <button
              className={`dashboard-nav-group-header ${expandedGroups.includes('telemetry') ? 'expanded' : ''}`}
              onClick={() => toggleGroup('telemetry')}
            >
              <div className="dashboard-nav-group-left">
                <Zap className="dashboard-nav-icon" />
                <span>Telemetry</span>
              </div>
              <ChevronRight className={`dashboard-chevron ${expandedGroups.includes('telemetry') ? 'rotated' : ''}`} />
            </button>
            {expandedGroups.includes('telemetry') && (
              <div className="dashboard-nav-subitems">
                {telemetryItems.map(item => (
                  <button
                    key={item.id}
                    className={`dashboard-nav-subitem ${activeView === item.id ? 'active' : ''}`}
                    onClick={() => setActiveView(item.id as any)}
                  >
                    <item.icon className="dashboard-subitem-icon" />
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Settings */}
          <button
            className={`dashboard-nav-item ${activeView === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveView('settings')}
          >
            <Settings className="dashboard-nav-icon" />
            <span>Settings</span>
          </button>

          {/* Integration */}
          <button
            className={`dashboard-nav-item ${activeView === 'integration' ? 'active' : ''}`}
            onClick={() => setActiveView('integration')}
          >
            <Key className="dashboard-nav-icon" />
            <span>Integration</span>
          </button>

          {/* Admin - Only visible to admin */}
          {isAdmin && (
            <button
              className={`dashboard-nav-item admin ${activeView === 'admin' ? 'active' : ''}`}
              onClick={() => setActiveView('admin')}
            >
              <Shield className="dashboard-nav-icon" />
              <span>Admin</span>
            </button>
          )}
        </nav>

        {/* Footer */}
        <div className="dashboard-sidebar-footer">
          <div className="dashboard-tenant-badge">
            <span className="dashboard-tenant-dot" />
            <span>{tenantName || 'Tenant'}</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="dashboard-main">
        {/* Header */}
        <header className="dashboard-header">
          <div className="dashboard-header-left">
            <h1 className="dashboard-page-title">
              {activeView === 'overview' && 'Dashboard'}
              {activeView === 'logs' && 'Logs'}
              {activeView === 'metrics' && 'Metrics'}
              {activeView === 'traces' && 'Traces'}
              {activeView === 'integration' && 'Integration'}
              {activeView === 'settings' && 'Settings'}
              {activeView === 'admin' && 'Platform Admin'}
            </h1>
            <span className="dashboard-tenant-label">
              {tenantName || tenantId}
            </span>
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

        {/* View Tabs */}
        {activeView !== 'overview' && (
          <div className="dashboard-tabs">
            {[
              { id: 'logs', label: 'Logs', icon: List },
              { id: 'metrics', label: 'Metrics', icon: BarChart3 },
              { id: 'traces', label: 'Traces', icon: GitBranch },
            ].map(tab => (
              <button
                key={tab.id}
                className={`dashboard-tab ${activeView === tab.id ? 'active' : ''}`}
                onClick={() => setActiveView(tab.id as any)}
              >
                <tab.icon className="dashboard-tab-icon" />
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="dashboard-content">
          {activeView === 'overview' && (
            <div className="dashboard-overview">
              {/* Stats Grid */}
              <div className="dashboard-stats-grid">
                <div className="dashboard-stat-card">
                  <div className="dashboard-stat-icon logs">
                    <List className="dashboard-stat-svg" />
                  </div>
                  <div className="dashboard-stat-info">
                    <span className="dashboard-stat-value">{stats.totalLogs}</span>
                    <span className="dashboard-stat-label">Total Logs</span>
                  </div>
                </div>

                <div className="dashboard-stat-card error">
                  <div className="dashboard-stat-icon error">
                    <AlertCircle className="dashboard-stat-svg" />
                  </div>
                  <div className="dashboard-stat-info">
                    <span className="dashboard-stat-value">{stats.errorRate.toFixed(1)}%</span>
                    <span className="dashboard-stat-label">Error Rate</span>
                    <span className="dashboard-stat-sub">{stats.errorCount} errors</span>
                  </div>
                </div>

                <div className="dashboard-stat-card">
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

                <div className="dashboard-stat-card">
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
                <div className="dashboard-panel">
                  <h3 className="dashboard-panel-title">Recent Logs</h3>
                  <LogsPanel tenantId={tenantId} refreshKey={refreshKey} compact onNavigateToTrace={handleNavigateToTrace} />
                </div>
                <div className="dashboard-panel">
                  <h3 className="dashboard-panel-title">Metrics</h3>
                  <MetricsChart tenantId={tenantId} refreshKey={refreshKey} />
                </div>
              </div>
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

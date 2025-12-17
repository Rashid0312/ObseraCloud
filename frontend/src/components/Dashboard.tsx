import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Dashboard.css';

interface Metric {
  metric: string;
  value: number;
  tenant_id: string;
}

interface Log {
  timestamp: string;
  level: string;
  message: string;
  tenant_id: string;
}

interface Trace {
  trace_id: string;
  duration_ms: number;
  service: string;
  tenant_id: string;
}

function Dashboard() {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [traces, setTraces] = useState<Trace[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'logs' | 'traces'>('overview');
  const navigate = useNavigate();

  const tenantId = localStorage.getItem('tenantId');
  const apiKey = localStorage.getItem('apiKey');

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const headers = { 'X-API-Key': apiKey || '' };
      
      const [metricsRes, logsRes, tracesRes] = await Promise.all([
        axios.get<Metric[]>(`http://localhost:5001/api/metrics?tenant_id=${tenantId}`, { headers }),
        axios.get<Log[]>(`http://localhost:5001/api/logs?tenant_id=${tenantId}`, { headers }),
        axios.get<Trace[]>(`http://localhost:5001/api/traces?tenant_id=${tenantId}`, { headers })
      ]);

      setMetrics(metricsRes.data);
      setLogs(logsRes.data);
      setTraces(tracesRes.data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching data:', err);
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        handleLogout();
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('tenantId');
    localStorage.removeItem('apiKey');
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>SkyView</h1>
          <span className="tenant-label">{tenantId}</span>
        </div>
        
        <nav className="sidebar-nav">
          <button 
            className={activeTab === 'overview' ? 'nav-item active' : 'nav-item'}
            onClick={() => setActiveTab('overview')}
          >
            <span className="nav-icon">📊</span>
            Overview
          </button>
          <button 
            className={activeTab === 'logs' ? 'nav-item active' : 'nav-item'}
            onClick={() => setActiveTab('logs')}
          >
            <span className="nav-icon">📝</span>
            Logs
          </button>
          <button 
            className={activeTab === 'traces' ? 'nav-item active' : 'nav-item'}
            onClick={() => setActiveTab('traces')}
          >
            <span className="nav-icon">🔍</span>
            Traces
          </button>
        </nav>

        <button onClick={handleLogout} className="logout-button">
          Logout
        </button>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="content-header">
          <h2>
            {activeTab === 'overview' && 'Overview'}
            {activeTab === 'logs' && 'Logs'}
            {activeTab === 'traces' && 'Traces'}
          </h2>
          <div className="header-actions">
            <span className="last-update">Last updated: {new Date().toLocaleTimeString()}</span>
          </div>
        </header>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="content-section">
            {/* Metrics Cards */}
            <div className="metrics-overview">
              {metrics.map((metric, idx) => (
                <div key={idx} className="metric-card">
                  <div className="metric-header">
                    <span className="metric-name">{metric.metric.replace('_', ' ')}</span>
                    <span className={`metric-status ${metric.value > 60 ? 'critical' : 'healthy'}`}>
                      {metric.value > 60 ? '⚠️' : '✓'}
                    </span>
                  </div>
                  <div className="metric-value-large">{metric.value}%</div>
                  <div className="metric-progress">
                    <div 
                      className="metric-progress-bar"
                      style={{ 
                        width: `${metric.value}%`,
                        backgroundColor: metric.value > 60 ? '#ef4444' : '#10b981'
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>

            {/* Recent Activity */}
            <div className="section-header">
              <h3>Recent Activity</h3>
            </div>
            <div className="activity-table">
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Type</th>
                    <th>Message</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.slice(0, 5).map((log, idx) => (
                    <tr key={idx}>
                      <td className="time-cell">{new Date(log.timestamp).toLocaleTimeString()}</td>
                      <td><span className={`type-badge ${log.level.toLowerCase()}`}>{log.level}</span></td>
                      <td>{log.message}</td>
                      <td><span className={`status-dot ${log.level.toLowerCase()}`}></span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Logs Tab */}
        {activeTab === 'logs' && (
          <div className="content-section">
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Level</th>
                    <th>Message</th>
                    <th>Tenant</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, idx) => (
                    <tr key={idx}>
                      <td className="time-cell">{new Date(log.timestamp).toLocaleString()}</td>
                      <td><span className={`type-badge ${log.level.toLowerCase()}`}>{log.level}</span></td>
                      <td className="message-cell">{log.message}</td>
                      <td className="tenant-cell">{log.tenant_id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Traces Tab */}
        {activeTab === 'traces' && (
          <div className="content-section">
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Trace ID</th>
                    <th>Service</th>
                    <th>Duration</th>
                    <th>Tenant</th>
                    <th>Performance</th>
                  </tr>
                </thead>
                <tbody>
                  {traces.map((trace, idx) => (
                    <tr key={idx}>
                      <td className="trace-id-cell"><code>{trace.trace_id}</code></td>
                      <td>{trace.service}</td>
                      <td className="duration-cell">{trace.duration_ms}ms</td>
                      <td className="tenant-cell">{trace.tenant_id}</td>
                      <td>
                        <div className="performance-bar">
                          <div 
                            className="performance-fill"
                            style={{ width: `${Math.min((trace.duration_ms / 600) * 100, 100)}%` }}
                          ></div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default Dashboard;

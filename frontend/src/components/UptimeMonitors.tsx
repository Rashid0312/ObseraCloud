import React, { useState, useEffect } from 'react';
import {
    Server, Plus, Trash2, CheckCircle, AlertTriangle,
    XCircle, Clock, Globe
} from 'lucide-react';
import { API_BASE_URL } from '../config';
import './UptimeMonitors.css';

interface Monitor {
    id: number;
    service_name: string;
    endpoint_url: string;
    check_interval_seconds: number;
    is_active: boolean;
    current_status: 'up' | 'down' | 'degraded' | 'pending';
    response_time_ms: number | null;
    uptime_24h: string | null;
    created_at: string;
    last_checked: string | null;
    recent_checks: Array<{ status: string; checked_at: string }>;
}

const formatTimeAgo = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const seconds = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
};

interface UptimeMonitorsProps {
    tenantId: string;
    refreshKey: number;
}

const UptimeMonitors: React.FC<UptimeMonitorsProps> = ({ tenantId, refreshKey }) => {
    const [monitors, setMonitors] = useState<Monitor[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [creating, setCreating] = useState(false);
    const [timeNow, setTimeNow] = useState(Date.now()); // For updating relative time

    useEffect(() => {
        const timer = setInterval(() => setTimeNow(Date.now()), 60000);
        return () => clearInterval(timer);
    }, []);

    // Form State
    const [newMonitor, setNewMonitor] = useState({
        service_name: '',
        endpoint_url: '',
        check_interval: 60
    });

    const fetchMonitors = async () => {
        try {
            const token = localStorage.getItem('token');
            const headers: HeadersInit = {
                'Content-Type': 'application/json'
            };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`${API_BASE_URL}/api/monitors?tenant_id=${tenantId}`, { headers });
            if (!res.ok) throw new Error('Failed to fetch monitors');

            const data = await res.json();
            setMonitors(data.monitors || []);
            setError('');
        } catch (err) {
            setError('Failed to load monitors');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMonitors();
        const interval = setInterval(fetchMonitors, 10000); // Poll every 10s for status updates
        return () => clearInterval(interval);
    }, [tenantId, refreshKey]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);

        try {
            const token = localStorage.getItem('token');
            const headers: HeadersInit = {
                'Content-Type': 'application/json'
            };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`${API_BASE_URL}/api/monitors`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ ...newMonitor, tenant_id: tenantId })
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Failed to create monitor');
            }

            await fetchMonitors();
            setShowCreateModal(false);
            setNewMonitor({ service_name: '', endpoint_url: '', check_interval: 60 });
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to create monitor');
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this monitor?')) return;

        try {
            const token = localStorage.getItem('token');
            const headers: HeadersInit = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`${API_BASE_URL}/api/endpoints/${id}?tenant_id=${tenantId}`, {
                method: 'DELETE',
                headers
            });

            if (!res.ok) throw new Error('Failed to delete monitor');

            setMonitors(monitors.filter(m => m.id !== id));
        } catch (err) {
            alert('Failed to delete monitor');
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'up': return 'status-up';
            case 'down': return 'status-down';
            case 'degraded': return 'status-degraded';
            default: return 'status-pending';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'up': return <CheckCircle size={18} />;
            case 'down': return <XCircle size={18} />;
            case 'degraded': return <AlertTriangle size={18} />;
            default: return <Clock size={18} />;
        }
    };

    if (loading) return <div className="uptime-loading"><div className="spinner"></div> Loading monitors...</div>;

    return (
        <div className="uptime-container">
            <div className="uptime-header">
                <div className="uptime-title">
                    <Server size={24} />
                    <h2>Uptime Monitors</h2>
                </div>
                <button className="create-monitor-btn" onClick={() => setShowCreateModal(true)}>
                    <Plus size={16} /> New Monitor
                </button>
            </div>

            {error && <div className="uptime-error"><AlertTriangle size={16} /> {error}</div>}

            <div className="monitors-grid">
                {monitors.length === 0 ? (
                    <div className="no-monitors">
                        <Globe size={48} />
                        <h3>No Monitors Configured</h3>
                        <p>Add an endpoint URL to start tracking uptime and response times.</p>
                        <button className="create-monitor-btn large" onClick={() => setShowCreateModal(true)}>
                            Start Monitoring
                        </button>
                    </div>
                ) : (
                    monitors.map(monitor => (
                        <div key={monitor.id} className={`monitor-card ${monitor.current_status}`}>
                            <div className="monitor-header">
                                <div className="monitor-name">
                                    <div className={`status-indicator ${getStatusColor(monitor.current_status)}`}>
                                        {getStatusIcon(monitor.current_status)}
                                    </div>
                                    <div>
                                        <h3>{monitor.service_name}</h3>
                                        <a href={monitor.endpoint_url} target="_blank" rel="noopener noreferrer" className="monitor-url">
                                            {monitor.endpoint_url}
                                        </a>
                                    </div>
                                </div>
                                <button className="delete-btn" onClick={() => handleDelete(monitor.id)}>
                                    <Trash2 size={16} />
                                </button>
                            </div>

                            <div className="monitor-stats">
                                <div className="stat-item">
                                    <span className="stat-label">Response</span>
                                    <span className="stat-value">
                                        {monitor.response_time_ms ? `${monitor.response_time_ms}ms` : '-'}
                                    </span>
                                </div>
                                <div className="stat-item">
                                    <span className="stat-label">Uptime (24h)</span>
                                    <span className={`stat-value ${parseFloat(monitor.uptime_24h || '100') < 99.9 ? 'warning' : 'good'}`}>
                                        {monitor.uptime_24h ? `${monitor.uptime_24h}%` : '100%'}
                                    </span>
                                </div>
                                <div className="stat-item">
                                    <span className="stat-label">Last Checked</span>
                                    <span className="stat-value text-sm" data-tick={timeNow}>
                                        {formatTimeAgo(monitor.last_checked)}
                                    </span>
                                </div>
                            </div>

                            {/* History Bar */}
                            <div className="history-bar-container">
                                <div className="history-label">Recent History</div>
                                <div className="history-bar">
                                    {[...Array(20)].map((_, i) => {
                                        // Index 0 is newest check result
                                        const index = 19 - i; // Try to order left-to-right (oldest -> newest)
                                        const check = monitor.recent_checks && index < monitor.recent_checks.length
                                            ? monitor.recent_checks[index]
                                            : null;

                                        const status = check ? check.status : 'empty';

                                        return (
                                            <div
                                                key={i}
                                                className={`history-block ${status || 'empty'}`}
                                                title={check ? new Date(check.checked_at).toLocaleTimeString() : 'No data'}
                                            />
                                        );
                                    })}
                                </div>
                            </div>


                        </div>
                    ))
                )}
            </div>

            {showCreateModal && (
                <div className="modal-overlay">
                    <div className="modal-content glass-panel">
                        <div className="modal-header">
                            <h3>Create New Monitor</h3>
                            <button className="close-btn" onClick={() => setShowCreateModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleCreate}>
                            <div className="form-group">
                                <label>Service Name</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Production API"
                                    value={newMonitor.service_name}
                                    onChange={e => setNewMonitor({ ...newMonitor, service_name: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Endpoint URL</label>
                                <input
                                    type="url"
                                    placeholder="https://api.example.com/health"
                                    value={newMonitor.endpoint_url}
                                    onChange={e => setNewMonitor({ ...newMonitor, endpoint_url: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Check Interval (seconds)</label>
                                <select
                                    value={newMonitor.check_interval}
                                    onChange={e => setNewMonitor({ ...newMonitor, check_interval: parseInt(e.target.value) })}
                                >
                                    <option value={30}>30 seconds</option>
                                    <option value={60}>1 minute</option>
                                    <option value={300}>5 minutes</option>
                                    <option value={600}>10 minutes</option>
                                </select>
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="cancel-btn" onClick={() => setShowCreateModal(false)}>Cancel</button>
                                <button type="submit" className="submit-btn" disabled={creating}>
                                    {creating ? 'Creating...' : 'Create Monitor'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UptimeMonitors;

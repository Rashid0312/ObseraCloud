import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../config';
import { Users, Activity, GitBranch, Shield, Check, X, RefreshCw, Clock, Building2 } from 'lucide-react';
import './AdminPanel.css';

interface Tenant {
    tenant_id: string;
    company_name: string;
    email: string;
    api_key_masked: string;
    is_active: boolean;
    created_at: string | null;
    last_login: string | null;
}

interface PlatformStats {
    total_tenants: number;
    active_tenants_24h: number;
    total_traces_24h: number;
    platform_status: string;
}

interface AdminPanelProps {
    token: string;
}

const AdminPanel = ({ token }: AdminPanelProps) => {
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [stats, setStats] = useState<PlatformStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchData = async () => {
        setLoading(true);
        setError('');

        try {
            const headers = {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            };

            const [tenantsRes, statsRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/admin/tenants`, { headers }),
                fetch(`${API_BASE_URL}/api/admin/stats`, { headers })
            ]);

            if (!tenantsRes.ok || !statsRes.ok) {
                throw new Error('Failed to fetch admin data');
            }

            const tenantsData = await tenantsRes.json();
            const statsData = await statsRes.json();

            setTenants(tenantsData.tenants || []);
            setStats(statsData);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [token]);

    const toggleTenant = async (tenantId: string) => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/tenant/${tenantId}/toggle`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (res.ok) {
                fetchData();
            }
        } catch (err) {
            console.error('Failed to toggle tenant:', err);
        }
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return 'Never';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getTimeAgo = (dateStr: string | null) => {
        if (!dateStr) return 'Never';
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays}d ago`;
    };

    if (loading) {
        return (
            <div className="admin-loading">
                <div className="admin-spinner" />
                <span>Loading admin data...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="admin-error">
                <Shield size={24} />
                <span>{error}</span>
            </div>
        );
    }

    return (
        <div className="admin-panel">
            {/* Header */}
            <div className="admin-header">
                <div className="admin-title">
                    <Shield size={24} />
                    <h2>Platform Administration</h2>
                </div>
                <button className="admin-refresh-btn" onClick={fetchData}>
                    <RefreshCw size={16} />
                    Refresh
                </button>
            </div>

            {/* Stats Grid */}
            {stats && (
                <div className="admin-stats-grid">
                    <div className="admin-stat-card">
                        <div className="admin-stat-icon users">
                            <Users size={20} />
                        </div>
                        <div className="admin-stat-info">
                            <span className="admin-stat-value">{stats.total_tenants}</span>
                            <span className="admin-stat-label">Total Tenants</span>
                        </div>
                    </div>

                    <div className="admin-stat-card">
                        <div className="admin-stat-icon active">
                            <Activity size={20} />
                        </div>
                        <div className="admin-stat-info">
                            <span className="admin-stat-value">{stats.active_tenants_24h}</span>
                            <span className="admin-stat-label">Active (24h)</span>
                        </div>
                    </div>

                    <div className="admin-stat-card">
                        <div className="admin-stat-icon traces">
                            <GitBranch size={20} />
                        </div>
                        <div className="admin-stat-info">
                            <span className="admin-stat-value">{stats.total_traces_24h}</span>
                            <span className="admin-stat-label">Traces (24h)</span>
                        </div>
                    </div>

                    <div className="admin-stat-card">
                        <div className={`admin-stat-icon ${stats.platform_status === 'healthy' ? 'healthy' : 'warning'}`}>
                            <Check size={20} />
                        </div>
                        <div className="admin-stat-info">
                            <span className="admin-stat-value">{stats.platform_status}</span>
                            <span className="admin-stat-label">Platform Status</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Tenants Table */}
            <div className="admin-tenants-section">
                <h3 className="admin-section-title">
                    <Building2 size={18} />
                    Registered Tenants
                </h3>

                <div className="admin-table-container">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Tenant ID</th>
                                <th>Company</th>
                                <th>API Key</th>
                                <th>Status</th>
                                <th>Registered</th>
                                <th>Last Active</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tenants.map(tenant => (
                                <tr key={tenant.tenant_id} className={!tenant.is_active ? 'inactive' : ''}>
                                    <td className="tenant-id">
                                        <code>{tenant.tenant_id}</code>
                                    </td>
                                    <td className="tenant-company">
                                        <span>{tenant.company_name}</span>
                                        {tenant.email && <small>{tenant.email}</small>}
                                    </td>
                                    <td className="tenant-apikey">
                                        <code>{tenant.api_key_masked}</code>
                                    </td>
                                    <td className="tenant-status">
                                        <span className={`status-badge ${tenant.is_active ? 'active' : 'inactive'}`}>
                                            {tenant.is_active ? <Check size={12} /> : <X size={12} />}
                                            {tenant.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="tenant-date">
                                        <Clock size={12} />
                                        {formatDate(tenant.created_at)}
                                    </td>
                                    <td className="tenant-last-active">
                                        <span className={tenant.last_login ? 'recent' : 'never'}>
                                            {getTimeAgo(tenant.last_login)}
                                        </span>
                                    </td>
                                    <td className="tenant-actions">
                                        <button
                                            className={`toggle-btn ${tenant.is_active ? 'deactivate' : 'activate'}`}
                                            onClick={() => toggleTenant(tenant.tenant_id)}
                                            title={tenant.is_active ? 'Deactivate tenant' : 'Activate tenant'}
                                        >
                                            {tenant.is_active ? 'Deactivate' : 'Activate'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {tenants.length === 0 && (
                    <div className="admin-empty">
                        <Users size={32} />
                        <span>No tenants registered yet</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminPanel;

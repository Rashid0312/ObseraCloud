import React, { useState, useEffect } from 'react';
import { Activity, CheckCircle, AlertTriangle, XCircle, Clock } from 'lucide-react';
import { API_BASE_URL } from '../config';
import './StatusPages.css'; // Reuse existing styles 
import './PublicStatusPage.css'; // Add specialized styles

interface PublicMonitor {
    service_name: string;
    // endpoint_url is hidden for security unless explicitly public
    current_status: string;
    uptime_24h: string;
    recent_checks: Array<{ status: string; checked_at: string }>;
}

interface PageData {
    page: {
        title: string;
        description: string;
    };
    monitors: PublicMonitor[];
}

const PublicStatusPage: React.FC = () => {
    const [data, setData] = useState<PageData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        // Extract slug from URL: /status/my-slug
        const pathParts = window.location.pathname.split('/');
        const slugIndex = pathParts.indexOf('status');
        if (slugIndex !== -1 && pathParts[slugIndex + 1]) {
            const slug = pathParts[slugIndex + 1];
            fetchPage(slug);
        } else {
            setError('Invalid Status Page URL');
            setLoading(false);
        }
    }, []);

    const fetchPage = async (slug: string) => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/status-pages/public/${slug}`);
            if (!res.ok) {
                if (res.status === 404) throw new Error('Status Page Not Found');
                throw new Error('Failed to load status page');
            }
            const json = await res.json();
            setData(json);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'up': return <CheckCircle size={24} className="text-success" />;
            case 'down': return <XCircle size={24} className="text-error" />;
            case 'degraded': return <AlertTriangle size={24} className="text-warning" />;
            default: return <Clock size={24} className="text-muted" />;
        }
    };

    if (loading) return <div className="public-loading"><div className="spinner"></div></div>;
    if (error) return <div className="public-error"><AlertTriangle size={48} /><h2>{error}</h2></div>;
    if (!data) return null;

    const allUp = data.monitors.every(m => m.current_status === 'up');

    return (
        <div className="public-status-page">
            <header className="status-header">
                <div className="header-content">
                    <h1>{data.page.title}</h1>
                    <p>{data.page.description}</p>
                </div>
                <div className={`overall-status ${allUp ? 'up' : 'issue'}`}>
                    {allUp ? <CheckCircle size={24} /> : <AlertTriangle size={24} />}
                    <span>{allUp ? 'All Systems Operational' : 'Some Systems Experiencing Issues'}</span>
                </div>
            </header>

            <main className="monitors-list">
                {data.monitors.map((monitor, idx) => (
                    <div key={idx} className="public-monitor-card glass-panel">
                        <div className="monitor-info">
                            <div className="monitor-identity">
                                {getStatusIcon(monitor.current_status)}
                                <h3>{monitor.service_name}</h3>
                            </div>
                            <div className="monitor-uptime">
                                <span className="label">24h Uptime</span>
                                <span className="value">{monitor.uptime_24h}%</span>
                            </div>
                        </div>

                        {/* History Bar - Reusing logic from UptimeMonitors but simplified */}
                        <div className="history-bar-container">
                            <div className="history-bar">
                                {[...Array(20)].map((_, i) => {
                                    const index = 19 - i;
                                    const check = monitor.recent_checks && index < monitor.recent_checks.length
                                        ? monitor.recent_checks[index]
                                        : null;
                                    const status = check ? check.status : 'empty';
                                    return (
                                        <div key={i} className={`history-block ${status}`} title={check ? new Date(check.checked_at).toLocaleString() : 'No Data'} />
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                ))}
            </main>

            <footer className="status-footer">
                <p>Powered by <strong>ObseraCloud</strong></p>
            </footer>
        </div>
    );
};

export default PublicStatusPage;

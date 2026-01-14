import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertTriangle, XCircle, Clock, Lock, ArrowRight } from 'lucide-react';
import { API_BASE_URL } from '../config';
import './StatusPages.css';
import './PublicStatusPage.css';
import ImpactGraph from './ImpactGraph';

interface PublicMonitor {
    service_name: string;
    current_status: string;
    uptime_24h: string;
    recent_checks: Array<{ status: string; checked_at: string }>;
}

interface PageData {
    page: {
        title: string;
        description: string;
        requires_auth?: boolean;
    };
    monitors?: PublicMonitor[];
    locked?: boolean;
}

const PublicStatusPage: React.FC = () => {
    const [data, setData] = useState<PageData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [slug, setSlug] = useState('');

    // Auth State
    const [password, setPassword] = useState('');
    const [token, setToken] = useState<string | null>(localStorage.getItem('sp_token')); // Simple persistence
    const [unlocking, setUnlocking] = useState(false);

    useEffect(() => {
        const pathParts = window.location.pathname.split('/');
        const slugIndex = pathParts.indexOf('status');
        if (slugIndex !== -1 && pathParts[slugIndex + 1]) {
            const s = pathParts[slugIndex + 1];
            setSlug(s);
            fetchPage(s, token);
        } else {
            setError('Invalid Status Page URL');
            setLoading(false);
        }
    }, [token]); // Re-fetch if token changes

    const fetchPage = async (slug: string, authToken: string | null) => {
        try {
            const headers: any = {};
            if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

            const res = await fetch(`${API_BASE_URL}/api/status-pages/public/${slug}`, { headers });

            if (res.status === 401 || (res.ok && (await res.clone().json()).locked)) {
                // If 401 or locked flag, show lock screen
                // Note: The backend logic I wrote returns 200 with {locked: true}
            }

            if (!res.ok) {
                if (res.status === 404) throw new Error('Status Page Not Found');
                if (res.status === 403) throw new Error('Private Page');
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

    const handleUnlock = async (e: React.FormEvent) => {
        e.preventDefault();
        setUnlocking(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/status-pages/public/${slug}/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            const json = await res.json();
            if (res.ok) {
                setToken(json.token);
                localStorage.setItem('sp_token', json.token);
                // fetchPage will trigger via useEffect dependency
            } else {
                alert(json.error || 'Incorrect password');
            }
        } catch (err) {
            alert('Verification failed');
        } finally {
            setUnlocking(false);
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

    // LOCKED VIEW
    if (data.locked) {
        return (
            <div className="public-status-page locked">
                <div className="lock-screen glass-panel">
                    <div className="lock-icon">
                        <Lock size={48} />
                    </div>
                    <h1>{data.page.title}</h1>
                    <p>This status page is private. Please enter the password.</p>

                    <form onSubmit={handleUnlock} className="lock-form">
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="Password"
                            autoFocus
                        />
                        <button type="submit" disabled={unlocking}>
                            {unlocking ? 'Verifying...' : 'Unlock Page'} <ArrowRight size={16} />
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    const allUp = data.monitors?.every(m => m.current_status === 'up') ?? true;

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
                {data.monitors?.map((monitor, idx) => (
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

                {/* IMPACT GRAPH */}
                <ImpactGraph slug={slug} token={token || undefined} />

            </main>

            <footer className="status-footer">
                <p>Powered by <strong>ObseraCloud</strong></p>
                {data.page.requires_auth && (
                    <button className="text-xs text-muted/50 mt-2 hover:text-white" onClick={() => {
                        setToken(null);
                        localStorage.removeItem('sp_token');
                    }}>Lock Page</button>
                )}
            </footer>
        </div>
    );
};

export default PublicStatusPage;

import React, { useState, useEffect } from 'react';
import { Globe, Plus, ExternalLink, Copy, AlertTriangle, CheckCircle, Trash2 } from 'lucide-react';
import { API_BASE_URL } from '../config';
import './StatusPages.css';

interface Monitor {
    id: number;
    service_name: string;
    endpoint_url: string;
}

interface StatusPage {
    id: number;
    slug: string;
    title: string;
    description: string;
    is_public: boolean;
    monitor_count: number;
    created_at: string;
}

interface StatusPagesProps {
    tenantId: string;
}

const StatusPages: React.FC<StatusPagesProps> = ({ tenantId }) => {
    const [pages, setPages] = useState<StatusPage[]>([]);
    const [monitors, setMonitors] = useState<Monitor[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);

    // Form State
    const [newPage, setNewPage] = useState({
        title: '',
        slug: '',
        description: '',
        monitors: [] as number[]
    });

    useEffect(() => {
        fetchData();
    }, [tenantId]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const headers = { 'Authorization': `Bearer ${token}` };

            const [pagesRes, monitorsRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/status-pages?tenant_id=${tenantId}`, { headers }),
                fetch(`${API_BASE_URL}/api/monitors?tenant_id=${tenantId}`, { headers })
            ]);

            if (pagesRes.ok) {
                const data = await pagesRes.json();
                setPages(data.pages || []);
            }
            if (monitorsRes.ok) {
                const data = await monitorsRes.json();
                setMonitors(data.monitors || []);
            }
        } catch (err) {
            console.error(err);
            setMessage({ type: 'error', text: 'Failed to load status pages' });
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE_URL}/api/status-pages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ ...newPage, tenant_id: tenantId })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to create page');

            setMessage({ type: 'success', text: 'Status page created successfully' });
            setShowCreateModal(false);
            setNewPage({ title: '', slug: '', description: '', monitors: [] });
            fetchData();
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message });
        }
    };

    const toggleMonitorSelection = (id: number) => {
        setNewPage(prev => {
            const selected = prev.monitors.includes(id)
                ? prev.monitors.filter(m => m !== id)
                : [...prev.monitors, id];
            return { ...prev, monitors: selected };
        });
    };

    // Auto-generate slug from title if empty
    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const title = e.target.value;
        setNewPage(prev => ({
            ...prev,
            title,
            slug: prev.slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
        }));
    };

    const copyLink = (slug: string) => {
        const url = `${window.location.origin}/status/${slug}`;
        navigator.clipboard.writeText(url);
        alert('Link copied to clipboard!');
    };

    return (
        <div className="status-pages-container">
            <div className="section-header">
                <div className="header-title">
                    <Globe size={24} />
                    <h2>Status Pages</h2>
                </div>
                <button className="primary-btn" onClick={() => setShowCreateModal(true)}>
                    <Plus size={16} /> Create Status Page
                </button>
            </div>

            {message && (
                <div className={`alert ${message.type}`}>
                    {message.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
                    {message.text}
                    <button onClick={() => setMessage(null)}>&times;</button>
                </div>
            )}

            <div className="pages-grid">
                {pages.length === 0 && !loading ? (
                    <div className="empty-state">
                        <Globe size={48} />
                        <h3>No Status Pages</h3>
                        <p>Create a public status page to communicate with your users.</p>
                    </div>
                ) : (
                    pages.map(page => (
                        <div key={page.id} className="status-page-card glass-panel">
                            <div className="card-header">
                                <h3>{page.title}</h3>
                                <span className={`badge ${page.is_public ? 'public' : 'private'}`}>
                                    {page.is_public ? 'Public' : 'Private'}
                                </span>
                            </div>
                            <div className="card-body">
                                <p className="slug">/status/{page.slug}</p>
                                <p className="description">{page.description || 'No description'}</p>
                                <div className="monitor-count">
                                    <AlertTriangle size={14} /> {page.monitor_count} Monitors
                                </div>
                            </div>
                            <div className="card-actions">
                                <button className="icon-btn" onClick={() => copyLink(page.slug)} title="Copy Link">
                                    <Copy size={16} />
                                </button>
                                <a href={`/status/${page.slug}`} target="_blank" rel="noopener noreferrer" className="icon-btn" title="View Page">
                                    <ExternalLink size={16} />
                                </a>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {showCreateModal && (
                <div className="modal-overlay">
                    <div className="modal-content glass-panel">
                        <div className="modal-header">
                            <h3>Create Status Page</h3>
                            <button onClick={() => setShowCreateModal(false)}>&times;</button>
                        </div>
                        <form onSubmit={handleCreate}>
                            <div className="form-group">
                                <label>Page Title</label>
                                <input
                                    type="text"
                                    value={newPage.title}
                                    onChange={handleTitleChange}
                                    placeholder="e.g. Acme API Status"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>URL Slug</label>
                                <div className="slug-input">
                                    <span>/status/</span>
                                    <input
                                        type="text"
                                        value={newPage.slug}
                                        onChange={e => setNewPage({ ...newPage, slug: e.target.value })}
                                        placeholder="acme-status"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Description</label>
                                <input
                                    type="text"
                                    value={newPage.description}
                                    onChange={e => setNewPage({ ...newPage, description: e.target.value })}
                                    placeholder="Operational status of our services"
                                />
                            </div>
                            <div className="form-group">
                                <label>Select Monitors to Display</label>
                                <div className="monitor-selector">
                                    {monitors.map(m => (
                                        <div
                                            key={m.id}
                                            className={`monitor-option ${newPage.monitors.includes(m.id) ? 'selected' : ''}`}
                                            onClick={() => toggleMonitorSelection(m.id)}
                                        >
                                            <div className="checkbox">
                                                {newPage.monitors.includes(m.id) && <CheckCircle size={12} />}
                                            </div>
                                            <span>{m.service_name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="modal-actions">
                                <button type="button" onClick={() => setShowCreateModal(false)} className="cancel-btn">Cancel</button>
                                <button type="submit" className="primary-btn">Create Page</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StatusPages;

import React, { useEffect, useState } from 'react';
import './CorrelatedView.css';

interface Span {
    spanId: string;
    parentSpanId: string;
    name: string;
    startTime: number;
    endTime: number;
    duration_ms: number;
    status: number;
    attributes: Record<string, string>;
}

interface LogEntry {
    timestamp: number;
    message: string;
    level: string;
    service: string;
    trace_id: string;
}

interface CorrelatedData {
    trace_id: string;
    tenant_id: string;
    trace: {
        traceId: string;
        spans: Span[];
        spanCount: number;
        duration_ms: number;
    } | null;
    logs: LogEntry[];
}

interface CorrelatedViewProps {
    traceId: string;
    tenantId: string;
    onClose: () => void;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';

const CorrelatedView: React.FC<CorrelatedViewProps> = ({ traceId, tenantId, onClose }) => {
    const [data, setData] = useState<CorrelatedData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'trace' | 'logs'>('trace');

    useEffect(() => {
        fetchCorrelatedData();
    }, [traceId, tenantId]);

    const fetchCorrelatedData = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(
                `${API_BASE_URL}/api/correlate/${traceId}?tenant_id=${tenantId}`
            );

            if (!response.ok) {
                throw new Error('Failed to fetch correlated data');
            }

            const result = await response.json();
            setData(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    const formatDuration = (ms: number) => {
        if (ms < 1) return '<1ms';
        if (ms < 1000) return `${Math.round(ms)}ms`;
        return `${(ms / 1000).toFixed(2)}s`;
    };

    const formatTimestamp = (ns: number) => {
        const date = new Date(ns / 1_000_000);
        return date.toLocaleTimeString();
    };

    if (loading) {
        return (
            <div className="correlated-view">
                <div className="correlated-header">
                    <h2>Loading...</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>
                <div className="loading-spinner">
                    <div className="spinner"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="correlated-view">
                <div className="correlated-header">
                    <h2>Error</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>
                <div className="error-message">{error}</div>
            </div>
        );
    }

    if (!data) return null;

    return (
        <div className="correlated-view">
            {/* Header */}
            <div className="correlated-header">
                <div className="header-info">
                    <h2>🔗 Trace Details</h2>
                    <code className="trace-id-badge">{traceId.slice(0, 16)}...</code>
                    {data.trace && (
                        <span className="duration-badge">
                            {formatDuration(data.trace.duration_ms)}
                        </span>
                    )}
                </div>
                <button className="close-btn" onClick={onClose}>×</button>
            </div>

            {/* Stats Bar */}
            <div className="stats-bar">
                <div className="stat">
                    <span className="stat-icon">🔗</span>
                    <span className="stat-value">{data.trace?.spanCount || 0}</span>
                    <span className="stat-label">Spans</span>
                </div>
                <div className="stat">
                    <span className="stat-icon">📝</span>
                    <span className="stat-value">{data.logs.length}</span>
                    <span className="stat-label">Logs</span>
                </div>
            </div>

            {/* Tabs - Only Trace and Logs */}
            <div className="tabs">
                <button
                    className={`tab ${activeTab === 'trace' ? 'active' : ''}`}
                    onClick={() => setActiveTab('trace')}
                >
                    Trace Spans
                </button>
                <button
                    className={`tab ${activeTab === 'logs' ? 'active' : ''}`}
                    onClick={() => setActiveTab('logs')}
                >
                    Related Logs
                </button>
            </div>

            {/* Content */}
            <div className="correlated-content">
                {/* Trace View */}
                {activeTab === 'trace' && (
                    <div className="trace-view">
                        {!data.trace || data.trace.spans.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-icon">🔍</div>
                                <div className="empty-text">No trace data found in Tempo</div>
                                <div className="empty-hint">The trace may have expired or not been ingested yet</div>
                            </div>
                        ) : (
                            data.trace.spans.map((span, index) => (
                                <div key={index} className={`span-row ${span.status === 2 ? 'error' : ''}`}>
                                    <div className="span-status-icon">
                                        {span.status === 2 ? '❌' : '✅'}
                                    </div>
                                    <div className="span-info">
                                        <div className="span-name">{span.name}</div>
                                        <div className="span-service">{span.attributes?.['service.name'] || 'unknown'}</div>
                                    </div>
                                    <div className="span-duration">{formatDuration(span.duration_ms)}</div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* Logs View */}
                {activeTab === 'logs' && (
                    <div className="logs-view">
                        {data.logs.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-icon">📝</div>
                                <div className="empty-text">No logs found with this trace ID</div>
                                <div className="empty-hint">Logs must include trace_id={traceId.slice(0, 8)}...</div>
                            </div>
                        ) : (
                            data.logs.map((log, index) => (
                                <div key={index} className={`log-row ${log.level}`}>
                                    <div className="log-time">{formatTimestamp(log.timestamp)}</div>
                                    <div className={`log-level-badge ${log.level}`}>{log.level}</div>
                                    <div className="log-service">{log.service}</div>
                                    <div className="log-message">{log.message}</div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CorrelatedView;

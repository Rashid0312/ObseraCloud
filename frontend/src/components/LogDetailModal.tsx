import React, { useState } from 'react';
import { X, Bot, Loader2, AlertCircle, Clock, Server, Tag, Copy, Check } from 'lucide-react';
import { API_BASE_URL } from '../config';
import './LogDetailModal.css';

interface Log {
    timestamp: string;
    level: string;
    service: string;
    message: string;
    endpoint?: string;
    method?: string;
    status?: string;
}

interface LogDetailModalProps {
    log: Log;
    tenantId: string;
    onClose: () => void;
}

interface AIResponse {
    analysis: string;
    tokens_used: number;
    estimated_cost: number;
}

// Code block component with copy button
const CodeBlock: React.FC<{ code: string; language?: string }> = ({ code, language }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="code-block">
            <div className="code-block-header">
                <span className="code-language">{language || 'code'}</span>
                <button className="copy-button" onClick={handleCopy}>
                    {copied ? (
                        <>
                            <Check size={14} />
                            <span>Copied!</span>
                        </>
                    ) : (
                        <>
                            <Copy size={14} />
                            <span>Copy code</span>
                        </>
                    )}
                </button>
            </div>
            <pre className="code-content"><code>{code}</code></pre>
        </div>
    );
};

// Parse markdown and render with proper code blocks
const renderAIResponse = (text: string): React.ReactNode[] => {
    const elements: React.ReactNode[] = [];
    let currentIndex = 0;

    // Match code blocks with language: ```language\ncode```
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    let match;

    while ((match = codeBlockRegex.exec(text)) !== null) {
        // Add text before code block
        if (match.index > currentIndex) {
            const textBefore = text.slice(currentIndex, match.index);
            elements.push(
                <div key={`text-${currentIndex}`}
                    dangerouslySetInnerHTML={{ __html: formatMarkdown(textBefore) }}
                />
            );
        }

        // Add code block
        elements.push(
            <CodeBlock
                key={`code-${match.index}`}
                code={match[2].trim()}
                language={match[1] || 'code'}
            />
        );

        currentIndex = match.index + match[0].length;
    }

    // Add remaining text after last code block
    if (currentIndex < text.length) {
        const remainingText = text.slice(currentIndex);
        elements.push(
            <div key={`text-${currentIndex}`}
                dangerouslySetInnerHTML={{ __html: formatMarkdown(remainingText) }}
            />
        );
    }

    return elements;
};

// Format simple markdown (not code blocks)
const formatMarkdown = (text: string): string => {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
        .replace(/### (.*)/g, '<h4>$1</h4>')
        .replace(/## (.*)/g, '<h3>$1</h3>')
        .replace(/^\d+\. /gm, '<span class="list-number">$&</span>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br/>');
};

const LogDetailModal: React.FC<LogDetailModalProps> = ({ log, tenantId, onClose }) => {
    const [aiLoading, setAiLoading] = useState(false);
    const [aiResponse, setAiResponse] = useState<AIResponse | null>(null);
    const [aiError, setAiError] = useState<string | null>(null);

    const isError = log.level.toLowerCase() === 'error';

    const handleDebugWithAI = async () => {
        setAiLoading(true);
        setAiError(null);

        try {
            const response = await fetch(`${API_BASE_URL}/api/ai/debug`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    tenant_id: tenantId,
                    log_message: log.message,
                    log_level: log.level,
                    service_name: log.service,
                    additional_context: `Endpoint: ${log.endpoint || 'N/A'}, Method: ${log.method || 'N/A'}, Status: ${log.status || 'N/A'}`
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to analyze log');
            }

            setAiResponse(data);
        } catch (err) {
            setAiError(err instanceof Error ? err.message : 'Failed to analyze log');
        } finally {
            setAiLoading(false);
        }
    };

    const formatTimestamp = (ts: string): string => {
        try {
            const date = new Date(parseInt(ts) / 1000000);
            return date.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
            });
        } catch {
            return ts;
        }
    };

    // Parse log message if it looks like headers/key-value pairs
    const parseStructuredMessage = (msg: string) => {
        const lines = msg.split('\n');
        const structured: Record<string, string> = {};
        let currentKey = '';

        lines.forEach(line => {
            if (line.includes(':') && !line.startsWith(' ')) {
                const [key, ...val] = line.split(':');
                currentKey = key.trim().toLowerCase();
                structured[currentKey] = val.join(':').trim();
            } else if (currentKey && line.trim()) {
                structured[currentKey] += ' ' + line.trim();
            }
        });

        // If we extracted a decent number of keys, return it, otherwise null
        return Object.keys(structured).length > 3 ? structured : null;
    };

    const structuredData = parseStructuredMessage(log.message);

    // Helper to render known interesting fields
    const renderMetadataSection = (data: Record<string, string>) => {
        // ---- NOISE FILTER: Headers that are meaningless to end users ----
        const HIDDEN_HEADERS = new Set([
            'accept', 'accept_encoding', 'accept_language', 'connection',
            'content_length', 'content_type', 'cookie', 'sec_ch_ua',
            'sec_ch_ua_mobile', 'sec_ch_ua_platform', 'sec_fetch_dest',
            'sec_fetch_mode', 'sec_fetch_site', 'upgrade_insecure_requests',
            'cache_control', 'pragma', 'if_none_match', 'if_modified_since',
            'collector_name', 'loki_resource_labels', 'priority',
            'x_vercel_deployment_url', 'x_vercel_id', 'x_vercel_ja4_fingerprint',
            'x_vercel_proxied_for', 'x_vercel_sc_headers', 'x_vercel_trace',
            'x_matched_path', 'x_real_ip', 'x_vercel_proxy_signature',
            'x_vercel_proxy_signature_ts', 'forwarded', 'x_forwarded_proto',
            'x_forwarded_host', 'x_forwarded_port', 'referer', 'origin',
        ]);

        // ---- EXTRACT USEFUL INFO ----
        const summary = {
            message: data['body'] || data['message'] || data['msg'] || null,
            method: data['method'] || null,
            path: data['path'] || data['url'] || data['endpoint'] || null,
            status: data['status'] || data['status_code'] || null,
            host: data['host'] || null,
            city: data['x_vercel_ip_city'] || null,
            country: data['x_vercel_ip_country'] || null,
            traceId: data['traceid'] || data['trace_id'] || null,
        };

        // Filter out hidden and already-shown headers for "other" section
        const otherHeaders = Object.entries(data).filter(([key]) => {
            const k = key.toLowerCase();
            return !HIDDEN_HEADERS.has(k) &&
                !['body', 'message', 'msg', 'method', 'path', 'url', 'endpoint',
                    'status', 'status_code', 'host', 'x_vercel_ip_city',
                    'x_vercel_ip_country', 'traceid', 'trace_id', 'detected_level'].includes(k);
        });

        return (
            <div className="log-structured-view">
                {/* Primary Summary Card */}
                {(summary.method || summary.path) && (
                    <div className="log-summary-card">
                        {summary.method && (
                            <span className={`method-badge ${summary.method.toLowerCase()}`}>
                                {summary.method}
                            </span>
                        )}
                        <span className="summary-path">{summary.path || '/'}</span>
                        {summary.status && (
                            <span className={`status-badge ${parseInt(summary.status) < 400 ? 'success' : 'error'}`}>
                                {summary.status}
                            </span>
                        )}
                    </div>
                )}

                {/* Message/Body if present */}
                {summary.message && (
                    <div className="log-message-box">
                        <pre>{summary.message}</pre>
                    </div>
                )}

                {/* Context Pills */}
                <div className="log-context-pills">
                    {summary.host && (
                        <span className="context-pill">
                            <Server size={12} /> {summary.host}
                        </span>
                    )}
                    {(summary.city || summary.country) && (
                        <span className="context-pill">
                            🌍 {summary.city ? `${summary.city}, ` : ''}{summary.country}
                        </span>
                    )}
                    {summary.traceId && (
                        <span className="context-pill trace">
                            <Tag size={12} /> {summary.traceId.slice(0, 8)}...
                        </span>
                    )}
                </div>

                {/* Other Fields (collapsed by default) */}
                {otherHeaders.length > 0 && (
                    <details className="raw-headers-details">
                        <summary>Additional Details ({otherHeaders.length})</summary>
                        <div className="raw-headers-grid">
                            {otherHeaders.map(([k, v]) => (
                                <div key={k} className="raw-header-row">
                                    <span className="header-key">{k}:</span>
                                    <span className="header-value">{String(v).slice(0, 100)}{String(v).length > 100 ? '...' : ''}</span>
                                </div>
                            ))}
                        </div>
                    </details>
                )}
            </div>
        );
    };

    return (
        <div className="log-modal-overlay" onClick={onClose}>
            <div className="log-modal-content" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="log-modal-header">
                    <div className="log-modal-title">
                        <span className={`log-level-badge ${log.level.toLowerCase()}`}>
                            {log.level.toUpperCase()}
                        </span>
                        <span className="log-service">{log.service}</span>
                        <span className="log-time-header">
                            {new Date(parseInt(log.timestamp) / 1000000).toLocaleTimeString()}
                        </span>
                    </div>
                    <button className="log-modal-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                {/* Log Details */}
                <div className="log-modal-body">
                    {/* Render Structured Data or Raw Message */}
                    {structuredData ? (
                        renderMetadataSection(structuredData)
                    ) : (
                        <div className="log-message-section">
                            <h4>Message</h4>
                            <pre className="log-message-content">{log.message}</pre>
                        </div>
                    )}

                    {/* Metadata Grid (if not parsed from message) */}
                    <div className="log-detail-grid">
                        <div className="log-detail-item">
                            <Clock size={14} />
                            <span className="log-detail-label">Timestamp</span>
                            <span className="log-detail-value">{formatTimestamp(log.timestamp)}</span>
                        </div>
                        <div className="log-detail-item">
                            <Server size={14} />
                            <span className="log-detail-label">Service</span>
                            <span className="log-detail-value">{log.service}</span>
                        </div>
                    </div>

                    {/* AI Debug Section - Only for errors */}
                    {isError && (
                        <div className="ai-debug-section">
                            <div className="ai-debug-header">
                                <Bot size={18} />
                                <span>AI Debug Assistant</span>
                            </div>

                            {!aiResponse && !aiLoading && !aiError && (
                                <button
                                    className="ai-debug-button"
                                    onClick={handleDebugWithAI}
                                >
                                    <Bot size={16} />
                                    Debug with AI
                                </button>
                            )}

                            {aiLoading && (
                                <div className="ai-loading">
                                    <Loader2 size={20} className="ai-spinner" />
                                    <span>Analyzing error...</span>
                                </div>
                            )}

                            {aiError && (
                                <div className="ai-error">
                                    <AlertCircle size={16} />
                                    <span>{aiError}</span>
                                    <button onClick={handleDebugWithAI}>Try Again</button>
                                </div>
                            )}

                            {aiResponse && (
                                <div className="ai-response">
                                    <div className="ai-response-content">
                                        {renderAIResponse(aiResponse.analysis)}
                                    </div>
                                    <div className="ai-response-meta">
                                        <span>Tokens: {aiResponse.tokens_used}</span>
                                        <span>Cost: ${aiResponse.estimated_cost.toFixed(6)}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LogDetailModal;

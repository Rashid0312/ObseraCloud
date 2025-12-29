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
                    </div>
                    <button className="log-modal-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                {/* Log Details */}
                <div className="log-modal-body">
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
                        {log.endpoint && (
                            <div className="log-detail-item">
                                <Tag size={14} />
                                <span className="log-detail-label">Endpoint</span>
                                <span className="log-detail-value">{log.method} {log.endpoint}</span>
                            </div>
                        )}
                    </div>

                    <div className="log-message-section">
                        <h4>Message</h4>
                        <pre className="log-message-content">{log.message}</pre>
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

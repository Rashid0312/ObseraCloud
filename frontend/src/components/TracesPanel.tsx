import React, { useEffect, useState } from 'react';
import { API_BASE_URL } from '../config';
import { AlertCircle, Check, X, ChevronDown, ChevronRight, Clock, Server, Layers } from 'lucide-react';
import './TracesPanel.css';

interface Trace {
  traceID: string;
  rootTraceName: string;
  rootServiceName: string;
  startTimeUnixNano: string;
  durationMs: number;
  status?: string;
}

interface Span {
  spanId: string;
  parentSpanId: string;
  operationName: string;
  serviceName: string;
  startTimeUnixNano: string;
  durationMs: number;
  status: string;
}

interface TraceDetail {
  traceId: string;
  spans: Span[];
  spanCount: number;
}

interface TracesPanelProps {
  tenantId: string;
  refreshKey?: number;
}

const TracesPanel: React.FC<TracesPanelProps> = ({ tenantId, refreshKey }) => {
  const [traces, setTraces] = useState<Trace[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [expandedTrace, setExpandedTrace] = useState<string | null>(null);
  const [traceDetails, setTraceDetails] = useState<TraceDetail | null>(null);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);

  useEffect(() => {
    if (!tenantId) return;

    const fetchTraces = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await fetch(`${API_BASE_URL}/api/traces?tenant_id=${tenantId}&limit=20`);
        if (!response.ok) throw new Error('Failed to fetch traces');
        const data = await response.json();
        setTraces(data.traces || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch traces');
      } finally {
        setLoading(false);
      }
    };

    fetchTraces();
    const interval = setInterval(fetchTraces, 15000);
    return () => clearInterval(interval);
  }, [tenantId, refreshKey]);

  const fetchTraceDetails = async (traceId: string) => {
    setLoadingDetails(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/traces/${traceId}`);
      if (!response.ok) throw new Error('Failed to fetch trace details');
      const data = await response.json();
      setTraceDetails(data);
    } catch (err) {
      console.error('Failed to fetch trace details:', err);
      setTraceDetails(null);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleTraceClick = async (traceId: string) => {
    if (expandedTrace === traceId) {
      setExpandedTrace(null);
      setTraceDetails(null);
    } else {
      setExpandedTrace(traceId);
      await fetchTraceDetails(traceId);
    }
  };

  const formatTimestamp = (nanoTime: string): string => {
    const ms = parseInt(nanoTime) / 1000000;
    return new Date(ms).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  const getDurationClass = (ms: number): string => {
    if (ms < 100) return 'fast';
    if (ms < 300) return 'medium';
    return 'slow';
  };

  const getBarWidth = (ms: number, maxMs: number): number => {
    return Math.min((ms / maxMs) * 100, 100);
  };

  // Build span hierarchy tree
  const buildSpanTree = (spans: Span[]): { span: Span; children: any[]; depth: number }[] => {
    const spanMap = new Map<string, { span: Span; children: any[] }>();
    const roots: { span: Span; children: any[]; depth: number }[] = [];

    // Create span nodes
    spans.forEach(span => {
      spanMap.set(span.spanId, { span, children: [] });
    });

    // Build tree
    spans.forEach(span => {
      const node = spanMap.get(span.spanId)!;
      if (!span.parentSpanId || span.parentSpanId === '') {
        roots.push({ ...node, depth: 0 });
      } else {
        const parent = spanMap.get(span.parentSpanId);
        if (parent) {
          parent.children.push({ ...node, depth: 0 });
        } else {
          roots.push({ ...node, depth: 0 });
        }
      }
    });

    // Flatten tree with depth
    const flattenTree = (nodes: any[], depth: number): any[] => {
      let result: any[] = [];
      nodes.forEach(node => {
        result.push({ ...node, depth });
        if (node.children.length > 0) {
          result = result.concat(flattenTree(node.children, depth + 1));
        }
      });
      return result;
    };

    return flattenTree(roots, 0);
  };

  if (loading && traces.length === 0) {
    return (
      <div className="obs-traces-loading">
        <div className="obs-loading-spinner" />
        <span>Loading traces...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="obs-traces-error">
        <AlertCircle className="obs-error-icon" />
        {error}
      </div>
    );
  }

  const maxDuration = Math.max(...traces.map(t => t.durationMs), 500);

  return (
    <div className="obs-traces-panel">
      {/* Header */}
      <div className="obs-traces-header">
        <div className="obs-traces-info">
          <span className="obs-traces-count">{traces.length} traces</span>
          <span className="obs-traces-period">Last 24 hours</span>
        </div>
      </div>

      {/* Traces List */}
      <div className="obs-traces-list">
        {traces.map((trace) => {
          const durationClass = getDurationClass(trace.durationMs);
          const isExpanded = expandedTrace === trace.traceID;
          const isError = trace.status === 'ERROR';

          return (
            <div
              key={trace.traceID}
              className={`obs-trace-card ${isError ? 'error' : ''} ${isExpanded ? 'expanded' : ''}`}
            >
              {/* Clickable Header */}
              <div
                className="obs-trace-header"
                onClick={() => handleTraceClick(trace.traceID)}
                style={{ cursor: 'pointer' }}
              >
                <div className="obs-trace-main">
                  <span className="obs-trace-expand-icon">
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </span>
                  <span className={`obs-trace-status ${isError ? 'error' : 'ok'}`}>
                    {isError ? <X className="obs-status-icon" /> : <Check className="obs-status-icon" />}
                  </span>
                  <div className="obs-trace-info">
                    <span className="obs-trace-operation">{trace.rootTraceName}</span>
                    <div className="obs-trace-meta">
                      <code className="obs-trace-id">{trace.traceID.substring(0, 16)}</code>
                      <span className="obs-trace-service">{trace.rootServiceName}</span>
                    </div>
                  </div>
                </div>
                <div className="obs-trace-timing">
                  <span className={`obs-trace-duration ${durationClass}`}>
                    {trace.durationMs}ms
                  </span>
                  <span className="obs-trace-time">{formatTimestamp(trace.startTimeUnixNano)}</span>
                </div>
              </div>

              {/* Duration Bar */}
              <div className="obs-trace-bar-container">
                <div className={`obs-trace-bar ${durationClass}`} style={{ width: `${getBarWidth(trace.durationMs, maxDuration)}%` }} />
              </div>

              {/* Expanded Span Waterfall */}
              {isExpanded && (
                <div className="obs-trace-waterfall">
                  {loadingDetails ? (
                    <div className="obs-waterfall-loading">
                      <div className="obs-loading-spinner small" />
                      <span>Loading span details...</span>
                    </div>
                  ) : traceDetails && traceDetails.spans.length > 0 ? (
                    <>
                      <div className="obs-waterfall-header">
                        <div className="obs-waterfall-title">
                          <Layers size={14} />
                          <span>Span Waterfall ({traceDetails.spanCount} spans)</span>
                        </div>
                        <div className="obs-waterfall-trace-id">
                          <code>{trace.traceID}</code>
                        </div>
                      </div>
                      <div className="obs-waterfall-spans">
                        {buildSpanTree(traceDetails.spans).map((item, idx) => {
                          const spanDurationClass = getDurationClass(item.span.durationMs);
                          const isSpanError = item.span.status === 'ERROR';
                          const totalDuration = Math.max(...traceDetails.spans.map(s => s.durationMs), 1);

                          return (
                            <div
                              key={`${item.span.spanId}-${idx}`}
                              className={`obs-waterfall-span ${isSpanError ? 'error' : ''}`}
                              style={{ paddingLeft: `${item.depth * 24 + 12}px` }}
                            >
                              <div className="obs-span-tree-line" style={{ left: `${item.depth * 24 + 4}px` }}>
                                {item.depth > 0 && <span className="obs-tree-branch">└─</span>}
                              </div>
                              <div className="obs-span-content">
                                <div className="obs-span-header">
                                  <Server size={12} className="obs-span-icon" />
                                  <span className="obs-span-service">{item.span.serviceName}</span>
                                  <span className="obs-span-operation">{item.span.operationName}</span>
                                  <span className={`obs-span-status ${isSpanError ? 'error' : 'ok'}`}>
                                    {isSpanError ? '✗' : '✓'}
                                  </span>
                                </div>
                                <div className="obs-span-bar-row">
                                  <div className="obs-span-bar-container">
                                    <div
                                      className={`obs-span-bar ${spanDurationClass}`}
                                      style={{ width: `${getBarWidth(item.span.durationMs, totalDuration)}%` }}
                                    />
                                  </div>
                                  <span className={`obs-span-duration ${spanDurationClass}`}>
                                    <Clock size={10} />
                                    {item.span.durationMs}ms
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="obs-waterfall-empty">
                      <span>No span details available</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TracesPanel;

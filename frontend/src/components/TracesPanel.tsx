import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { API_BASE_URL } from '../config';
import { AlertCircle, Check, X, ChevronDown, ChevronRight, Clock, Server, Layers, Link } from 'lucide-react';
import './TracesPanel.css';
import CorrelatedView from './CorrelatedView';
import { DataDeletionPanel } from './DataDeletionPanel';

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
  highlightedTraceId?: string | null;
}

const TIME_RANGES = [
  { label: 'Last 15 min', value: '0.25', hours: 0.25 },
  { label: 'Last 1 hour', value: '1', hours: 1 },
  { label: 'Last 6 hours', value: '6', hours: 6 },
  { label: 'Last 24 hours', value: '24', hours: 24 },
];

const TracesPanel: React.FC<TracesPanelProps> = ({ tenantId, refreshKey, highlightedTraceId }) => {
  const [traces, setTraces] = useState<Trace[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [expandedTrace, setExpandedTrace] = useState<string | null>(null);
  const [traceDetails, setTraceDetails] = useState<TraceDetail | null>(null);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);

  const [newTraceIds, setNewTraceIds] = useState<Set<string>>(new Set());
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [timeRange, setTimeRange] = useState<string>('24'); // Default 24 hours
  const [correlatedTraceId, setCorrelatedTraceId] = useState<string | null>(null);
  const [showDeletion, setShowDeletion] = useState(false);

  // Auto-expand trace when navigating from logs panel
  // Auto-expand trace when navigating from logs panel
  useEffect(() => {
    if (!highlightedTraceId) return;

    const traceExists = traces.find(t => t.traceID === highlightedTraceId);

    if (traceExists) {
      setExpandedTrace(highlightedTraceId);
      // Scroll to the highlighted trace after a short delay
      setTimeout(() => {
        const traceElement = document.getElementById(`trace-${highlightedTraceId}`);
        if (traceElement) {
          traceElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    } else {
      // Trace not found in list (likely due to cache delay), fetch it directly
      console.log(`Fetching missing trace: ${highlightedTraceId}`);
      fetch(`${API_BASE_URL}/api/traces/${highlightedTraceId}`)
        .then(res => {
          if (!res.ok) throw new Error('Trace not found');
          return res.json();
        })
        .then(data => {
          if (data && data.spans && data.spans.length > 0) {
            // Construct trace summary from details
            const rootSpan = data.spans[0]; // Sorted by time in backend
            const hasError = data.spans.some((s: any) => s.status === 'ERROR');

            // Calculate total duration
            const startTimes = data.spans.map((s: any) => parseInt(s.startTimeUnixNano));
            const endTimes = data.spans.map((s: any) => parseInt(s.startTimeUnixNano) + (s.durationMs * 1000000));
            const minStart = Math.min(...startTimes);
            const maxEnd = Math.max(...endTimes);
            const totalDurationMs = (maxEnd - minStart) / 1000000;

            const newTrace: Trace = {
              traceID: data.traceId, // Note: backend returns traceId here
              rootTraceName: rootSpan.operationName,
              rootServiceName: rootSpan.serviceName,
              startTimeUnixNano: rootSpan.startTimeUnixNano,
              durationMs: Math.round(totalDurationMs) || rootSpan.durationMs,
              status: hasError ? 'ERROR' : 'OK'
            };

            // Add to top of list and highlight, avoiding duplicates
            setTraces(prev => {
              if (prev.some(t => t.traceID === newTrace.traceID)) {
                return prev;
              }
              return [newTrace, ...prev];
            });
            // The effect will run again due to traces dependency and handle scrolling
          }
        })
        .catch(err => {
          console.error("Failed to fetch missing trace:", err);
        });
    }
  }, [highlightedTraceId, traces]);

  useEffect(() => {
    if (!tenantId) return;

    const fetchTraces = async (isAutoRefresh = false) => {
      // Only show loading spinner on initial load, not auto-refreshes
      if (!isAutoRefresh) {
        setLoading(true);
      }
      setError('');

      try {
        const hours = parseFloat(timeRange);

        // Include JWT token for authentication
        const token = localStorage.getItem('token');
        const headers: HeadersInit = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${API_BASE_URL}/api/traces?tenant_id=${tenantId}&limit=100&hours=${hours}`, { headers });
        if (!response.ok) throw new Error('Failed to fetch traces');
        const data = await response.json();
        // Sort traces by timestamp - newest first
        const sortedTraces = (data.traces || []).sort((a: Trace, b: Trace) => {
          const timeA = parseInt(a.startTimeUnixNano) || 0;
          const timeB = parseInt(b.startTimeUnixNano) || 0;
          return timeB - timeA;
        });

        // Track new traces for highlight animation
        if (isAutoRefresh && traces.length > 0) {
          const existingIds = new Set(traces.map(t => t.traceID));
          const newIds = sortedTraces
            .filter((t: Trace) => !existingIds.has(t.traceID))
            .map((t: Trace) => t.traceID);
          if (newIds.length > 0) {
            setNewTraceIds(new Set(newIds));
            // Clear highlight after animation
            setTimeout(() => setNewTraceIds(new Set()), 3000);
          }
        }

        setTraces(sortedTraces);
        setIsInitialLoad(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch traces');
      } finally {
        setLoading(false);
      }
    };

    fetchTraces(false); // Initial load
    const interval = setInterval(() => fetchTraces(true), 5000); // Auto-refresh every 5s
    return () => clearInterval(interval);
  }, [tenantId, refreshKey, timeRange]);

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

  const getServiceClass = (name: string): string => {
    const lower = name.toLowerCase();
    if (lower.includes('front') || lower.includes('ui') || lower.includes('react')) return 'service-frontend';
    if (lower.includes('back') || lower.includes('api') || lower.includes('server')) return 'service-backend';
    if (lower.includes('db') || lower.includes('sql') || lower.includes('mongo') || lower.includes('postgres')) return 'service-database';
    if (lower.includes('gate') || lower.includes('proxy') || lower.includes('auth')) return 'service-gateway';
    return '';
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
          <div className="obs-time-selector">
            <Clock size={14} className="obs-time-icon" />
            <select
              value={timeRange}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTimeRange(e.target.value)}
              className="obs-filter-select obs-time-select"
            >
              {TIME_RANGES.map(range => (
                <option key={range.value} value={range.value}>{range.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="obs-header-actions">
          <div className="obs-live-indicator">
            <span className="obs-live-dot"></span>
            <span>Live</span>
          </div>
          <button
            className="obs-delete-btn"
            onClick={() => setShowDeletion(true)}
            style={{
              padding: '6px 12px',
              background: '#f44336',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '0.85rem',
              marginLeft: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            Delete Data
          </button>
        </div>
      </div>

      {/* Traces List */}
      <div className="obs-traces-list">
        {traces.map((trace) => {
          const durationClass = getDurationClass(trace.durationMs);
          const isExpanded = expandedTrace === trace.traceID;
          const isError = trace.status === 'ERROR';

          const isNew = newTraceIds.has(trace.traceID);

          return (
            <div
              key={trace.traceID}
              id={`trace-${trace.traceID}`}
              className={`obs-trace-card ${isError ? 'error' : ''} ${isExpanded ? 'expanded' : ''} ${isNew ? 'new-trace' : ''} ${highlightedTraceId === trace.traceID ? 'highlighted' : ''}`}
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
                      <span className={`obs-trace-service ${getServiceClass(trace.rootServiceName)}`}>
                        {trace.rootServiceName}
                      </span>
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
                          <button
                            className="obs-correlate-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCorrelatedTraceId(trace.traceID);
                            }}
                          >
                            <Link size={14} />
                            View Correlated
                          </button>
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
                                  <span className={`obs-trace-service ${getServiceClass(item.span.serviceName)}`}>
                                    {item.span.serviceName}
                                  </span>
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

      {/* Correlated View Modal - rendered via portal to escape overflow:hidden */}
      {correlatedTraceId && createPortal(
        <div className="obs-correlated-modal-overlay" onClick={() => setCorrelatedTraceId(null)}>
          <div className="obs-correlated-modal" onClick={(e) => e.stopPropagation()}>
            <CorrelatedView
              traceId={correlatedTraceId}
              tenantId={tenantId}
              onClose={() => setCorrelatedTraceId(null)}
            />
          </div>
        </div>,
        document.body
      )}

      {/* Data Deletion Modal */}
      {showDeletion && (
        <DataDeletionPanel
          tenantId={tenantId}
          onClose={() => setShowDeletion(false)}
        />
      )}
    </div>
  );
};

export default TracesPanel;

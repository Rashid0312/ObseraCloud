import React, { useEffect, useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { API_BASE_URL } from '../config';
import { AlertCircle, Check, X, ChevronDown, ChevronRight, Clock, Server, Layers, Link, Copy, Info, Search, Filter, Sparkles, Brain, Trash2 } from 'lucide-react';
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
  spanAttributes?: Record<string, string>;
  resourceAttributes?: Record<string, string>;
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

  // AI Trace Doctor States
  const [diagnosisResult, setDiagnosisResult] = useState<string | null>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [showDiagnosisModal, setShowDiagnosisModal] = useState(false);

  // Filter states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [durationFilter, setDurationFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

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
        if (!token) return;

        const headers: HeadersInit = {};
        headers['Authorization'] = `Bearer ${token}`;

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
    const interval = setInterval(() => fetchTraces(true), 30000); // Auto-refresh every 30s
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

  const handleDiagnose = async (traceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDiagnosing(true);
    setDiagnosisResult(null); // Clear previous
    setShowDiagnosisModal(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/ai/diagnose/${traceId}?tenant_id=${tenantId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Diagnosis failed");
      }

      setDiagnosisResult(data.diagnosis || "No diagnosis returned.");
    } catch (err) {
      setDiagnosisResult(`**Error:** Failed to diagnose trace.\n\n${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsDiagnosing(false);
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

  // ======= HOOKS MUST BE BEFORE ANY RETURNS =======
  // Extract unique values for filter dropdowns
  const uniqueServices = useMemo(() => {
    const services = [...new Set(traces.map(t => t.rootServiceName))].filter(Boolean);
    return services.sort();
  }, [traces]);

  const uniqueOperations = useMemo(() => {
    const ops = [...new Set(traces.map(t => t.rootTraceName))].filter(Boolean);
    return ops.sort();
  }, [traces]);

  // Duration categories helper (not a hook)
  const getDurationCategory = (ms: number): string => {
    if (ms < 100) return 'fast';
    if (ms < 500) return 'medium';
    return 'slow';
  };

  // Filter traces based on all criteria
  const filteredTraces = useMemo(() => {
    return traces.filter(trace => {
      // Search query filter (matches operation name, service, or trace ID)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesOperation = trace.rootTraceName?.toLowerCase().includes(query);
        const matchesService = trace.rootServiceName?.toLowerCase().includes(query);
        const matchesTraceId = trace.traceID?.toLowerCase().includes(query);
        if (!matchesOperation && !matchesService && !matchesTraceId) return false;
      }

      // Service filter
      if (serviceFilter !== 'all' && trace.rootServiceName !== serviceFilter) return false;

      // Status filter
      if (statusFilter !== 'all') {
        const isError = trace.status === 'ERROR';
        if (statusFilter === 'error' && !isError) return false;
        if (statusFilter === 'ok' && isError) return false;
      }

      // Duration filter
      if (durationFilter !== 'all') {
        const category = getDurationCategory(trace.durationMs);
        if (durationFilter !== category) return false;
      }

      return true;
    });
  }, [traces, searchQuery, serviceFilter, statusFilter, durationFilter]);

  // Count active filters
  const activeFilterCount = [
    searchQuery,
    serviceFilter !== 'all' ? serviceFilter : '',
    statusFilter !== 'all' ? statusFilter : '',
    durationFilter !== 'all' ? durationFilter : ''
  ].filter(Boolean).length;

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery('');
    setServiceFilter('all');
    setStatusFilter('all');
    setDurationFilter('all');
  };

  const maxDuration = Math.max(...traces.map(t => t.durationMs), 500);

  // ======= EARLY RETURNS AFTER ALL HOOKS =======
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
              padding: '4px 10px',
              background: '#f44336',
              border: 'none',
              borderRadius: '6px',
              color: '#ffffff',
              cursor: 'pointer',
              fontSize: '0.75rem',
              marginLeft: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 700
            }}
          >
            <Trash2 size={12} />
            Delete Data
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="obs-filter-bar">
        {/* Search Input */}
        <div className="obs-search-wrapper">
          <Search size={16} className="obs-search-icon" />
          <input
            type="text"
            placeholder="Search traces by operation, service, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="obs-search-input"
          />
          {searchQuery && (
            <button className="obs-search-clear" onClick={() => setSearchQuery('')}>
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter Dropdowns */}
        <div className="obs-filter-dropdowns">
          <div className="obs-filter-group">
            <label>Service</label>
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="obs-filter-dropdown"
            >
              <option value="all">All Services</option>
              {uniqueServices.map(service => (
                <option key={service} value={service}>{service}</option>
              ))}
            </select>
          </div>

          <div className="obs-filter-group">
            <label>Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="obs-filter-dropdown"
            >
              <option value="all">All Status</option>
              <option value="ok">✓ OK</option>
              <option value="error">✗ Error</option>
            </select>
          </div>

          <div className="obs-filter-group">
            <label>Duration</label>
            <select
              value={durationFilter}
              onChange={(e) => setDurationFilter(e.target.value)}
              className="obs-filter-dropdown"
            >
              <option value="all">All Durations</option>
              <option value="fast">Fast (&lt;100ms)</option>
              <option value="medium">Medium (100-500ms)</option>
              <option value="slow">Slow (&gt;500ms)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Active Filters */}
      {activeFilterCount > 0 && (
        <div className="obs-active-filters">
          <span className="obs-filter-label">
            <Filter size={14} />
            Active Filters:
          </span>
          {searchQuery && (
            <span className="obs-filter-chip">
              Search: "{searchQuery.length > 20 ? searchQuery.slice(0, 20) + '...' : searchQuery}"
              <button onClick={() => setSearchQuery('')}><X size={12} /></button>
            </span>
          )}
          {serviceFilter !== 'all' && (
            <span className="obs-filter-chip service">
              Service: {serviceFilter}
              <button onClick={() => setServiceFilter('all')}><X size={12} /></button>
            </span>
          )}
          {statusFilter !== 'all' && (
            <span className={`obs-filter-chip ${statusFilter}`}>
              Status: {statusFilter === 'ok' ? '✓ OK' : '✗ Error'}
              <button onClick={() => setStatusFilter('all')}><X size={12} /></button>
            </span>
          )}
          {durationFilter !== 'all' && (
            <span className="obs-filter-chip duration">
              Duration: {durationFilter === 'fast' ? '<100ms' : durationFilter === 'medium' ? '100-500ms' : '>500ms'}
              <button onClick={() => setDurationFilter('all')}><X size={12} /></button>
            </span>
          )}
          <button className="obs-clear-filters" onClick={clearFilters}>
            Clear All
          </button>
        </div>
      )}

      {/* Results Count */}
      {activeFilterCount > 0 && (
        <div className="obs-filter-results">
          Showing {filteredTraces.length} of {traces.length} traces
        </div>
      )}

      {/* Traces List */}
      <div className="obs-traces-list">
        {filteredTraces.length === 0 && activeFilterCount > 0 ? (
          <div className="obs-no-results">
            <Search size={40} className="obs-no-results-icon" />
            <p>No traces match your filters</p>
            <button onClick={clearFilters} className="obs-reset-filters-btn">Reset Filters</button>
          </div>
        ) : filteredTraces.map((trace) => {
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
                      <button
                        className="obs-copy-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(trace.traceID);
                        }}
                        title="Copy full trace ID"
                      >
                        <Copy size={12} />
                      </button>
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

                          <button
                            className="obs-diagnose-btn"
                            onClick={(e) => handleDiagnose(trace.traceID, e)}
                            disabled={isDiagnosing}
                          >
                            <Sparkles size={14} />
                            {isDiagnosing && showDiagnosisModal ? 'Thinking...' : 'Diagnose'}
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

      {/* Data Deletion Modal - rendered via portal to escape overflow:hidden */}
      {showDeletion && createPortal(
        <DataDeletionPanel
          tenantId={tenantId}
          onClose={() => setShowDeletion(false)}
        />,
        document.body
      )}

      {/* AI Diagnosis Modal */}
      {showDiagnosisModal && createPortal(
        <div className="obs-ai-modal-overlay" onClick={() => setShowDiagnosisModal(false)}>
          <div className="obs-ai-modal" onClick={e => e.stopPropagation()}>
            <div className="obs-ai-modal-header">
              <div className="obs-ai-title">
                <Brain size={20} color="#a855f7" />
                <span>Trace Doctor Diagnosis</span>
              </div>
              <button className="obs-ai-close-btn" onClick={() => setShowDiagnosisModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="obs-ai-content">
              {isDiagnosing ? (
                <div className="obs-traces-loading">
                  <div className="obs-loading-spinner" />
                  <span>Analyzing trace patterns and logs...</span>
                </div>
              ) : (
                // Simple Markdown-ish rendering
                <div className="obs-ai-markdown">
                  {diagnosisResult?.split('\n').map((line, i) => {
                    if (line.startsWith('## ')) return <h2 key={i}>{line.replace('## ', '')}</h2>
                    if (line.startsWith('- ')) return <li key={i}>{line.replace('- ', '')}</li>
                    if (line.trim() === '') return <br key={i} />
                    return <p key={i}>{line}</p>
                  })}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default TracesPanel;

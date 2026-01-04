import React, { useEffect, useState, type ChangeEvent } from 'react';
import { API_BASE_URL } from '../config';
import { Search, AlertCircle, ChevronDown, Clock, Bot } from 'lucide-react';
import './LogsPanel.css';
import LogDetailModal from './LogDetailModal';

interface Log {
  timestamp: string;
  level: string;
  message: string;
  service: string;
  trace_id?: string;
  labels?: {
    [key: string]: string;
  };
}

interface LogsPanelProps {
  tenantId: string;
  refreshKey?: number;
  compact?: boolean;
  onNavigateToTrace?: (traceId: string) => void;
}

const TIME_RANGES = [
  { label: 'Last 15 min', value: '0.25', hours: 0.25 },
  { label: 'Last 1 hour', value: '1', hours: 1 },
  { label: 'Last 6 hours', value: '6', hours: 6 },
  { label: 'Last 24 hours', value: '24', hours: 24 },
];

const LogsPanel: React.FC<LogsPanelProps> = ({ tenantId, refreshKey, compact, onNavigateToTrace }) => {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [filter, setFilter] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [expandedLog, setExpandedLog] = useState<number | null>(null);
  const [timeRange, setTimeRange] = useState<string>('1'); // Default 1 hour
  const [selectedLog, setSelectedLog] = useState<Log | null>(null); // For AI debug modal

  useEffect(() => {
    if (!tenantId) return;

    const fetchLogs = async () => {
      setLoading(true);
      setError('');

      try {
        const hours = parseFloat(timeRange);
        const url = `${API_BASE_URL}/api/logs?tenant_id=${tenantId}&limit=${compact ? 10 : 100}&hours=${hours}${filter ? `&level=${filter.toLowerCase()}` : ''}`;

        // Include JWT token for authentication
        const token = localStorage.getItem('token');
        const headers: HeadersInit = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(url, { headers });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        setLogs(data.logs || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch logs');
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
    const interval = setInterval(fetchLogs, 10000);
    return () => clearInterval(interval);
  }, [tenantId, filter, refreshKey, compact, timeRange]);

  const getLevelClass = (level: string): string => {
    const upperLevel = level.toUpperCase();
    switch (upperLevel) {
      case 'ERROR':
        return 'obs-level-error';
      case 'WARN':
        return 'obs-level-warn';
      case 'INFO':
        return 'obs-level-info';
      default:
        return 'obs-level-debug';
    }
  };

  const filteredLogs = logs.filter((log) => search === '' || log.message.toLowerCase().includes(search.toLowerCase()));

  // Calculate stats
  const errorCount = logs.filter(l => l.level.toUpperCase() === 'ERROR').length;
  const warnCount = logs.filter(l => l.level.toUpperCase() === 'WARN').length;
  const infoCount = logs.filter(l => l.level.toUpperCase() === 'INFO').length;

  if (loading && logs.length === 0) {
    return (
      <div className="obs-logs-loading">
        <div className="obs-loading-spinner" />
        <span>Loading logs...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="obs-logs-error">
        <AlertCircle className="obs-error-icon" />
        {error}
      </div>
    );
  }

  return (
    <>
      <div className={`obs-logs-panel ${compact ? 'obs-logs-compact' : ''}`}>
        {!compact && (
          <>
            {/* Stats Bar */}
            <div className="obs-logs-stats">
              <div className="obs-log-stat">
                <span className="obs-stat-value">{logs.length}</span>
                <span className="obs-stat-label">Total</span>
              </div>
              <div className="obs-log-stat error">
                <span className="obs-stat-value">{errorCount}</span>
                <span className="obs-stat-label">Errors</span>
              </div>
              <div className="obs-log-stat warn">
                <span className="obs-stat-value">{warnCount}</span>
                <span className="obs-stat-label">Warnings</span>
              </div>
              <div className="obs-log-stat info">
                <span className="obs-stat-value">{infoCount}</span>
                <span className="obs-stat-label">Info</span>
              </div>
            </div>

            {/* Toolbar */}
            <div className="obs-logs-toolbar">
              <div className="obs-logs-search">
                <Search className="obs-search-icon" />
                <input
                  type="text"
                  placeholder="Search logs..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="obs-logs-filters">
                {/* Time Range Selector */}
                <div className="obs-time-selector">
                  <Clock size={14} className="obs-time-icon" />
                  <select
                    value={timeRange}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => setTimeRange(e.target.value)}
                    className="obs-filter-select obs-time-select"
                  >
                    {TIME_RANGES.map(range => (
                      <option key={range.value} value={range.value}>{range.label}</option>
                    ))}
                  </select>
                </div>

                {/* Level Filter */}
                <select
                  value={filter}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => setFilter(e.target.value)}
                  className="obs-filter-select"
                >
                  <option value="">All levels</option>
                  <option value="INFO">INFO</option>
                  <option value="WARN">WARN</option>
                  <option value="ERROR">ERROR</option>
                </select>
                <span className="obs-logs-count">{filteredLogs.length} logs</span>
              </div>
            </div>
          </>
        )}

        <div className="obs-logs-list">
          {filteredLogs.length === 0 ? (
            <div className="obs-logs-empty">
              <p>No logs found for the selected time range</p>
              <span>Try selecting a longer time range or check if data is being generated</span>
            </div>
          ) : (
            filteredLogs.map((log, index) => (
              <div
                key={index}
                className={`obs-log-entry ${expandedLog === index ? 'expanded' : ''}`}
              >
                <div
                  className="obs-log-main"
                  onClick={() => setExpandedLog(expandedLog === index ? null : index)}
                >
                  <span className="obs-log-time">
                    {new Date(log.timestamp).toLocaleTimeString('en-US', {
                      hour12: false,
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                  <span className={`obs-log-level ${getLevelClass(log.level)}`}>
                    {log.level.toUpperCase()}
                  </span>
                  {log.level.toUpperCase() === 'ERROR' && (
                    <button
                      className="ai-debug-btn-inline"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedLog(log);
                      }}
                      title="Debug with AI"
                    >
                      <Bot size={14} />
                    </button>
                  )}
                  <span className="obs-log-service">
                    {log.service}
                  </span>
                  <span className="obs-log-message">
                    {log.message}
                  </span>
                  <ChevronDown className={`obs-log-expand-icon ${expandedLog === index ? 'rotated' : ''}`} />
                </div>

                {expandedLog === index && log.labels && (
                  <div className="obs-log-details">
                    <div className="obs-log-details-section">
                      <h4>Metadata</h4>
                      <div className="obs-log-metadata">
                        {/* Always show timestamp */}
                        <div className="obs-metadata-item">
                          <span className="obs-metadata-key">Timestamp:</span>
                          <span className="obs-metadata-value">{log.timestamp}</span>
                        </div>

                        {/* Clickable Trace ID for cross-telemetry correlation */}
                        {(log.trace_id || log.labels?.trace_id) && (
                          <div className="obs-metadata-item obs-trace-link">
                            <span className="obs-metadata-key">Trace ID:</span>
                            <button
                              className="obs-trace-id-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                const traceId = log.trace_id || log.labels?.trace_id;
                                if (traceId && onNavigateToTrace) {
                                  onNavigateToTrace(traceId);
                                }
                              }}
                              title="View trace in Traces panel"
                            >
                              🔗 {(log.trace_id || log.labels?.trace_id)?.slice(0, 16)}...
                            </button>
                          </div>
                        )}

                        {/* Filtered labels - show only useful ones */}
                        {(() => {
                          // List of noisy headers to hide
                          const HIDDEN_KEYS = new Set([
                            'trace_id', 'traceid', 'accept', 'accept_encoding', 'accept_language',
                            'connection', 'content_length', 'content_type', 'cookie',
                            'sec_ch_ua', 'sec_ch_ua_mobile', 'sec_ch_ua_platform',
                            'sec_fetch_dest', 'sec_fetch_mode', 'sec_fetch_site',
                            'upgrade_insecure_requests', 'cache_control', 'pragma',
                            'collector_name', 'loki_resource_labels', 'priority',
                            'x_vercel_deployment_url', 'x_vercel_id', 'x_vercel_ja4_fingerprint',
                            'x_vercel_proxied_for', 'x_vercel_sc_headers', 'x_vercel_trace',
                            'x_vercel_proxy_signature', 'x_vercel_proxy_signature_ts',
                            'x_vercel_oidc_token', 'x_vercel_internal_bot_check',
                            'x_vercel_internal_ingress_bucket', 'x_vercel_internal_ingress_port',
                            'x_matched_path', 'x_real_ip', 'forwarded', 'x_forwarded_proto',
                            'x_forwarded_host', 'x_forwarded_port', 'x_forwarded_for',
                            'x_vercel_forwarded_for', 'x_vercel_function_path',
                            'x_vercel_ip_as_number', 'x_vercel_ip_continent', 'x_vercel_ip_latitude',
                            'x_vercel_ip_longitude', 'x_vercel_ip_postal_code', 'x_vercel_ip_timezone',
                            'referer', 'origin', 'user_agent', 'useragent', 'detected_level',
                            'severity_text', 'x_vercel_ja4_digest', 'x_vercel_ip_country_region'
                          ]);

                          const visibleLabels = Object.entries(log.labels || {})
                            .filter(([key]) => !HIDDEN_KEYS.has(key.toLowerCase()));

                          return visibleLabels.map(([key, value]) => (
                            <div key={key} className="obs-metadata-item">
                              <span className="obs-metadata-key">{key}:</span>
                              <span className="obs-metadata-value">{value}</span>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>

                    {(log.level.toLowerCase() === 'error' || log.level.toLowerCase() === 'warn') && (
                      <div className="obs-log-details-section">
                        <h4>🔍 Debug Guide</h4>
                        <div className="obs-debug-info">
                          <div className="obs-debug-section">
                            <strong>📍 Where to Look:</strong>
                            <ul>
                              <li>
                                <strong>Service:</strong> <code>{log.service || 'N/A'}</code>
                                {log.labels?.endpoint && (
                                  <> → <code>{log.labels.endpoint}</code></>
                                )}
                              </li>
                              {log.labels?.method && (
                                <li><strong>HTTP Method:</strong> <code>{log.labels.method}</code></li>
                              )}
                              {log.labels?.status && (
                                <li>
                                  <strong>Status Code:</strong>{' '}
                                  <code className={parseInt(log.labels.status) >= 500 ? 'status-error' : 'status-warn'}>
                                    {log.labels.status}
                                  </code>
                                  {parseInt(log.labels.status) >= 500 && <span className="hint"> (Server Error - Check backend logs)</span>}
                                  {parseInt(log.labels.status) >= 400 && parseInt(log.labels.status) < 500 && <span className="hint"> (Client Error - Check request params)</span>}
                                </li>
                              )}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* AI Debug Modal */}
      {
        selectedLog && (
          <LogDetailModal
            log={selectedLog}
            tenantId={tenantId}
            onClose={() => setSelectedLog(null)}
          />
        )}
    </>
  );
};

export default LogsPanel;

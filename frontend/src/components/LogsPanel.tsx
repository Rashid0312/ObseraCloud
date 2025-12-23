import React, { useEffect, useState, type ChangeEvent } from 'react';
import { API_BASE_URL } from '../config';
import { Search, AlertCircle, ChevronDown } from 'lucide-react';
import './LogsPanel.css';

interface Log {
  timestamp: string;
  level: string;
  message: string;
  service: string;
  labels?: {
    [key: string]: string;
  };
}

interface LogsPanelProps {
  tenantId: string;
  refreshKey?: number;
  compact?: boolean;
}

const LogsPanel: React.FC<LogsPanelProps> = ({ tenantId, refreshKey, compact }) => {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [filter, setFilter] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [expandedLog, setExpandedLog] = useState<number | null>(null);

  useEffect(() => {
    if (!tenantId) return;

    const fetchLogs = async () => {
      setLoading(true);
      setError('');

      try {
        const url = `${API_BASE_URL}/api/logs?tenant_id=${tenantId}&limit=${compact ? 10 : 50}${filter ? `&level=${filter.toLowerCase()}` : ''}`;
        const response = await fetch(url);

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
  }, [tenantId, filter, refreshKey, compact]);

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
    <div className={`obs-logs-panel ${compact ? 'obs-logs-compact' : ''}`}>
      {!compact && (
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
      )}

      <div className="obs-logs-list">
        {filteredLogs.map((log, index) => (
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
                    <div className="obs-metadata-item">
                      <span className="obs-metadata-key">Timestamp:</span>
                      <span className="obs-metadata-value">{log.timestamp}</span>
                    </div>
                    {Object.entries(log.labels).map(([key, value]) => (
                      <div key={key} className="obs-metadata-item">
                        <span className="obs-metadata-key">{key}:</span>
                        <span className="obs-metadata-value">{value}</span>
                      </div>
                    ))}
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

                      <div className="obs-debug-section">
                        <strong>🛠️ Immediate Actions:</strong>
                        <ul>
                          <li>✓ Check <code>{log.service}</code> health status and recent deploys</li>
                          {log.labels?.endpoint && (
                            <li>✓ Review <code>{log.labels.endpoint}</code> handler code</li>
                          )}
                          {log.labels?.database && (
                            <li>✓ Verify database connection: <code>{log.labels.database}</code></li>
                          )}
                          {log.level.toLowerCase() === 'error' && (
                            <>
                              <li>✓ Search for related traces to see full request flow</li>
                              <li>✓ Check error tracking for similar issues</li>
                            </>
                          )}
                        </ul>
                      </div>

                      <div className="obs-debug-section">
                        <strong>📋 Configuration to Verify:</strong>
                        <ul>
                          <li>Environment variables for <code>{log.service}</code></li>
                          {log.labels?.endpoint && (
                            <li>Route configuration and middleware for <code>{log.labels.endpoint}</code></li>
                          )}
                          <li>Service dependencies and external API credentials</li>
                          {log.labels?.tenant_id && (
                            <li>Tenant-specific settings for: <code>{log.labels.tenant_id}</code></li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default LogsPanel;

import React, { useEffect, useState, type ChangeEvent } from 'react';
import {
  AreaChart, Area, BarChart, Bar, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  Activity, AlertCircle, Clock, TrendingUp, Zap,
  Server, ArrowUp, ArrowDown, Minus, Download,
  RefreshCw, CheckCircle, XCircle, ChevronDown, AlertTriangle
} from 'lucide-react';
import { API_BASE_URL } from '../config';
import './MetricsChart.css';

interface LokiMetric {
  timestamp: string;
  metric_name: string;
  value: string;
  labels: { [key: string]: string };
}

interface UptimeData {
  uptime_percentage: number;
  total_checks: number;
  successful_checks: number;
  avg_response_ms: number;
  services: Array<{
    service_name: string;
    uptime_percentage: number;
    total_checks: number;
  }>;
  ongoing_outages: Array<{
    service_name: string;
    started_at: string;
    failure_count: number;
  }>;
  status: string;
}

interface MetricsChartProps {
  tenantId: string;
  refreshKey?: number;
}

// Thresholds for contextual alerts
const THRESHOLDS = {
  responseTime: { good: 200, warning: 500, critical: 1000 }, // milliseconds
  errorRate: { good: 1, warning: 5, critical: 10 }, // percentage
  uptime: { good: 99.9, warning: 99, critical: 95 }, // percentage
};

const TIME_RANGES = [
  { label: 'Last 15 min', value: '0.25', hours: 0.25 },
  { label: 'Last 1 hour', value: '1', hours: 1 },
  { label: 'Last 6 hours', value: '6', hours: 6 },
  { label: 'Last 24 hours', value: '24', hours: 24 },
];

const MetricsChart: React.FC<MetricsChartProps> = ({ tenantId, refreshKey }) => {
  const [metrics, setMetrics] = useState<LokiMetric[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [timeRange, setTimeRange] = useState<string>('1');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isLive, setIsLive] = useState<boolean>(true);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [uptimeData, setUptimeData] = useState<UptimeData | null>(null);

  // Chart navigation state
  const [timeBucket, setTimeBucket] = useState<number>(60); // Default to 60 minutes (1 hour)
  const [chartPage, setChartPage] = useState<number>(0); // 0 = latest, 1 = previous page, etc.
  const POINTS_PER_PAGE = 60; // Show up to 60 data points (1 per minute)

  useEffect(() => {
    if (!tenantId) return;

    const fetchMetrics = async () => {
      if (!isLive && metrics.length > 0) return;

      try {
        const hours = parseFloat(timeRange);
        const url = `${API_BASE_URL}/api/metrics?tenant_id=${tenantId}&hours=${hours}`;

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
        setMetrics(data.metrics || []);
        setLastUpdated(new Date());
        setError('');

        // Fetch real uptime data
        try {
          const uptimeResponse = await fetch(
            `${API_BASE_URL}/api/uptime?tenant_id=${tenantId}&hours=${Math.ceil(hours)}`,
            { headers }
          );
          if (uptimeResponse.ok) {
            const uptimeResult = await uptimeResponse.json();
            setUptimeData(uptimeResult);
          }
        } catch (uptimeErr) {
          console.warn('Failed to fetch uptime data:', uptimeErr);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch metrics');
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000); // Auto-refresh every 30s
    return () => clearInterval(interval);
  }, [tenantId, refreshKey, timeRange, isLive]);

  const exportData = () => {
    const dataStr = JSON.stringify(metrics, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `metrics-${tenantId}-${new Date().toISOString()}.json`;
    a.click();
  };

  // Helper to get status class based on thresholds
  const getResponseStatus = (ms: number) => {
    if (ms <= THRESHOLDS.responseTime.good) return 'good';
    if (ms <= THRESHOLDS.responseTime.warning) return 'warning';
    return 'critical';
  };

  const getErrorStatus = (rate: number) => {
    if (rate <= THRESHOLDS.errorRate.good) return 'good';
    if (rate <= THRESHOLDS.errorRate.warning) return 'warning';
    return 'critical';
  };

  const getUptimeStatus = (uptime: number) => {
    if (uptime >= THRESHOLDS.uptime.good) return 'good';
    if (uptime >= THRESHOLDS.uptime.warning) return 'warning';
    return 'critical';
  };

  if (loading && metrics.length === 0) {
    return (
      <div className="obs-metrics-loading">
        <div className="obs-loading-spinner" />
        <span>Loading metrics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="obs-metrics-error">
        <AlertCircle className="obs-error-icon" />
        {error}
      </div>
    );
  }

  if (metrics.length === 0) {
    return (
      <div className="obs-metrics-empty">
        <Activity size={48} strokeWidth={1} />
        <p>No metrics available</p>
        <span>Metrics will appear here once your applications start sending data</span>
      </div>
    );
  }

  // Group metrics by name
  const metricsByName: { [key: string]: LokiMetric[] } = {};
  metrics.forEach(m => {
    if (!metricsByName[m.metric_name]) {
      metricsByName[m.metric_name] = [];
    }
    metricsByName[m.metric_name].push(m);
  });

  // Prepare chart data with aligned timestamps
  const prepareChartData = (metricName: string) => {
    const metricValues = metricsByName[metricName] || [];
    return metricValues
      .slice(0, 50)
      .reverse()
      .map(m => ({
        time: new Date(m.timestamp).toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit'
        }),
        value: parseFloat(m.value) || 0,
      }));
  };

  // Prepare combined chart data with aligned time axis and time window filtering
  const prepareCombinedData = () => {
    const requestsRaw = metricsByName['http_requests_total'] || [];
    const errorsRaw = metricsByName['http_errors_total'] || [];

    // Calculate time window cutoff
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - timeBucket * 60 * 1000);

    // Create time key at 1-minute intervals for detailed view
    const getTimeKey = (date: Date) => {
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    };

    // Create a map of all timestamps
    const timeMap: { [key: string]: { requests: number; errors: number; rawTime: Date } } = {};

    // Add requests data (filtered by time window)
    requestsRaw.filter(m => new Date(m.timestamp) >= cutoffTime).forEach(m => {
      const date = new Date(m.timestamp);
      const timeKey = getTimeKey(date);
      if (!timeMap[timeKey]) {
        timeMap[timeKey] = { requests: 0, errors: 0, rawTime: date };
      }
      timeMap[timeKey].requests += parseFloat(m.value) || 0;
    });

    // Add errors data (filtered by time window)
    errorsRaw.filter(m => new Date(m.timestamp) >= cutoffTime).forEach(m => {
      const date = new Date(m.timestamp);
      const timeKey = getTimeKey(date);
      if (!timeMap[timeKey]) {
        timeMap[timeKey] = { requests: 0, errors: 0, rawTime: date };
      }
      timeMap[timeKey].errors += parseFloat(m.value) || 0;
    });

    // Convert to sorted array
    const allData = Object.entries(timeMap)
      .map(([time, data]) => ({ time, ...data }))
      .sort((a, b) => a.rawTime.getTime() - b.rawTime.getTime());

    // Paginate: show POINTS_PER_PAGE at a time
    const totalPoints = allData.length;
    const startIdx = Math.max(0, totalPoints - POINTS_PER_PAGE - (chartPage * POINTS_PER_PAGE));
    const endIdx = Math.min(totalPoints, startIdx + POINTS_PER_PAGE);

    return {
      visibleData: allData.slice(startIdx, endIdx),
      totalPoints,
      canGoBack: startIdx > 0,
      canGoForward: chartPage > 0,
    };
  };

  const chartData = prepareCombinedData();
  const combinedChartData = chartData.visibleData;

  // Calculate stats
  const requestsData = metricsByName['http_requests_total'] || [];
  const errorsData = metricsByName['http_errors_total'] || [];
  // Support both naming conventions: http_response_time_seconds (in seconds) and http.server.duration (in ms)
  const responseTimeData = metricsByName['http_response_time_seconds'] || [];
  const durationData = metricsByName['http.server.duration'] || [];

  // Calculate totals
  const totalRequests = requestsData.reduce((sum, m) => sum + parseFloat(m.value), 0);
  const totalErrors = errorsData.reduce((sum, m) => sum + parseFloat(m.value), 0);

  // Calculate from whichever metric is available
  let avgResponseMs = 0;
  if (responseTimeData.length > 0) {
    // http_response_time_seconds is in seconds, convert to ms
    const respTimes = responseTimeData.map(m => parseFloat(m.value)).filter(v => !isNaN(v));
    const avgResponseTime = respTimes.reduce((a, b) => a + b, 0) / respTimes.length;
    avgResponseMs = avgResponseTime * 1000;
  } else if (durationData.length > 0) {
    // http.server.duration is already in milliseconds
    const durations = durationData.map(m => parseFloat(m.value)).filter(v => !isNaN(v));
    avgResponseMs = durations.reduce((a, b) => a + b, 0) / durations.length;
  }

  const responseTimes = responseTimeData.length > 0
    ? responseTimeData.map(m => parseFloat(m.value)).filter(v => !isNaN(v))
    : durationData.map(m => parseFloat(m.value) / 1000).filter(v => !isNaN(v)); // Convert ms to seconds for percentile calc

  // Percentiles
  const sortedTimes = [...responseTimes].sort((a, b) => a - b);
  const p50 = sortedTimes[Math.floor(sortedTimes.length * 0.5)] || 0;
  const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)] || 0;
  const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)] || 0;

  const errorRate = totalRequests > 0 ? ((totalErrors / totalRequests) * 100) : 0;
  const successRate = 100 - errorRate;
  const requestRate = requestsData.length > 0
    ? (totalRequests / (parseFloat(timeRange) * 60)).toFixed(1)
    : '0';

  // Trend calculation
  const calcTrend = (data: LokiMetric[]) => {
    if (data.length < 4) return 'stable';
    const mid = Math.floor(data.length / 2);
    const firstHalf = data.slice(0, mid).reduce((s, m) => s + parseFloat(m.value), 0) / mid;
    const secondHalf = data.slice(mid).reduce((s, m) => s + parseFloat(m.value), 0) / (data.length - mid);
    const change = ((secondHalf - firstHalf) / (firstHalf || 1)) * 100;
    if (change > 10) return 'up';
    if (change < -10) return 'down';
    return 'stable';
  };

  const requestTrend = calcTrend(requestsData);
  const errorTrend = calcTrend(errorsData);
  const healthStatus = errorRate < 1 ? 'excellent' : errorRate < 5 ? 'good' : 'warning';

  // Use real uptime from API, fallback to synthetic if not available
  const uptimeValue = uptimeData?.uptime_percentage ?? parseFloat((100 - (errorRate * 0.1)).toFixed(2));
  const hasRealUptime = uptimeData !== null;

  // Get statuses
  const responseStatus = getResponseStatus(avgResponseMs);
  const errorStatus = getErrorStatus(errorRate);
  const uptimeStatus = getUptimeStatus(uptimeValue);

  const TrendIcon = ({ trend }: { trend: string }) => {
    if (trend === 'up') return <ArrowUp size={14} className="trend-up" />;
    if (trend === 'down') return <ArrowDown size={14} className="trend-down" />;
    return <Minus size={14} className="trend-stable" />;
  };

  const handleCardClick = (cardId: string) => {
    setExpandedCard(expandedCard === cardId ? null : cardId);
  };

  return (
    <div className="obs-metrics">
      {/* Header */}
      <div className="obs-metrics-header">
        <div className="obs-metrics-title">
          <Activity size={20} />
          <h3>Service Metrics</h3>
          <span className={`obs-health-badge ${healthStatus}`}>
            {healthStatus === 'excellent' ? <><CheckCircle size={12} /> Excellent</> :
              healthStatus === 'good' ? <><CheckCircle size={12} /> Good</> :
                <><AlertTriangle size={12} /> Degraded</>}
          </span>
        </div>
        <div className="obs-header-actions">
          <div className={`obs-live-badge ${isLive ? 'active' : ''}`} onClick={() => setIsLive(!isLive)}>
            <span className="obs-live-dot" />
            {isLive ? 'Live' : 'Paused'}
          </div>
          <div className="obs-time-selector">
            <Clock size={14} />
            <select
              value={timeRange}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setTimeRange(e.target.value)}
              className="obs-time-select"
            >
              {TIME_RANGES.map(range => (
                <option key={range.value} value={range.value}>{range.label}</option>
              ))}
            </select>
          </div>
          <button className="obs-action-btn" onClick={exportData} title="Export Data">
            <Download size={16} />
          </button>
        </div>
      </div>

      <div className="obs-last-updated">
        <RefreshCw size={12} />
        Last updated: {lastUpdated.toLocaleTimeString()}
      </div>

      {/* Primary Stats Cards */}
      <div className="obs-metrics-cards">
        {/* Total Requests Card */}
        <div
          className={`obs-metric-card requests ${expandedCard === 'requests' ? 'expanded' : ''}`}
          onClick={() => handleCardClick('requests')}
        >
          <div className="obs-card-header">
            <div className="obs-card-icon-wrap">
              <TrendingUp size={20} />
            </div>
            <ChevronDown size={16} className={`obs-expand-icon ${expandedCard === 'requests' ? 'rotated' : ''}`} />
          </div>
          <div className="obs-card-body">
            <span className="obs-card-label">Total Requests</span>
            <span className="obs-card-value">
              {Math.round(totalRequests).toLocaleString()}
              <TrendIcon trend={requestTrend} />
            </span>
            <span className="obs-card-sub">{requestRate} req/min</span>
          </div>
          {expandedCard === 'requests' && (
            <div className="obs-card-expanded">
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={prepareChartData('http_requests_total')}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                  <XAxis dataKey="time" stroke="rgba(255, 255, 255, 0.3)" fontSize={10} tick={{ fill: 'rgba(255, 255, 255, 0.5)' }} />
                  <YAxis stroke="rgba(255, 255, 255, 0.3)" fontSize={10} tick={{ fill: 'rgba(255, 255, 255, 0.5)' }} />
                  <Area type="monotone" dataKey="value" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Avg Response Card - WITH THRESHOLD */}
        <div
          className={`obs-metric-card response-time ${responseStatus} ${expandedCard === 'response' ? 'expanded' : ''}`}
          onClick={() => handleCardClick('response')}
        >
          <div className="obs-card-header">
            <div className="obs-card-icon-wrap">
              <Zap size={20} />
            </div>
            <ChevronDown size={16} className={`obs-expand-icon ${expandedCard === 'response' ? 'rotated' : ''}`} />
          </div>
          <div className="obs-card-body">
            <span className="obs-card-label">Avg Response</span>
            <span className={`obs-card-value status-${responseStatus}`}>
              {avgResponseMs.toFixed(0)}ms
              {responseStatus === 'critical' && <AlertTriangle size={16} className="warning-pulse" />}
            </span>
            <span className="obs-card-sub">
              Target: &lt;{THRESHOLDS.responseTime.good}ms
              {responseStatus !== 'good' && <span className="obs-threshold-warning"> · Above target</span>}
            </span>
          </div>
          {expandedCard === 'response' && (
            <div className="obs-card-expanded">
              <div className="obs-threshold-legend">
                <span className="good">● Good (&lt;{THRESHOLDS.responseTime.good}ms)</span>
                <span className="warning">● Warning (&lt;{THRESHOLDS.responseTime.warning}ms)</span>
                <span className="critical">● Critical (&gt;{THRESHOLDS.responseTime.critical}ms)</span>
              </div>
              <div className="obs-percentile-bars">
                <div className="obs-percentile">
                  <span>P50</span>
                  <div className={`obs-percentile-bar ${getResponseStatus(p50 * 1000)}`}><div style={{ width: `${Math.min(p50 * 100, 100)}%` }} /></div>
                  <span>{(p50 * 1000).toFixed(0)}ms</span>
                </div>
                <div className="obs-percentile">
                  <span>P95</span>
                  <div className={`obs-percentile-bar ${getResponseStatus(p95 * 1000)}`}><div style={{ width: `${Math.min(p95 * 100, 100)}%` }} /></div>
                  <span>{(p95 * 1000).toFixed(0)}ms</span>
                </div>
                <div className="obs-percentile">
                  <span>P99</span>
                  <div className={`obs-percentile-bar ${getResponseStatus(p99 * 1000)}`}><div style={{ width: `${Math.min(p99 * 100, 100)}%` }} /></div>
                  <span>{(p99 * 1000).toFixed(0)}ms</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Error Rate Card - WITH THRESHOLD */}
        <div
          className={`obs-metric-card error-rate ${errorStatus} ${expandedCard === 'errors' ? 'expanded' : ''}`}
          onClick={() => handleCardClick('errors')}
        >
          <div className="obs-card-header">
            <div className="obs-card-icon-wrap">
              <AlertCircle size={20} />
            </div>
            <ChevronDown size={16} className={`obs-expand-icon ${expandedCard === 'errors' ? 'rotated' : ''}`} />
          </div>
          <div className="obs-card-body">
            <span className="obs-card-label">Error Rate</span>
            <span className={`obs-card-value status-${errorStatus}`}>
              {errorRate.toFixed(2)}%
              <TrendIcon trend={errorTrend} />
              {errorStatus === 'critical' && <AlertTriangle size={16} className="warning-pulse" />}
            </span>
            <span className="obs-card-sub">
              Target: &lt;{THRESHOLDS.errorRate.good}%
              {errorStatus !== 'good' && <span className="obs-threshold-warning"> · {Math.round(totalErrors)} errors</span>}
            </span>
          </div>
          {expandedCard === 'errors' && (
            <div className="obs-card-expanded">
              <div className="obs-threshold-legend">
                <span className="good">● Good (&lt;{THRESHOLDS.errorRate.good}%)</span>
                <span className="warning">● Warning (&lt;{THRESHOLDS.errorRate.warning}%)</span>
                <span className="critical">● Critical (&gt;{THRESHOLDS.errorRate.critical}%)</span>
              </div>
              <div className="obs-error-breakdown">
                <div className="obs-error-stat">
                  <span className="obs-error-stat-label">Success Rate</span>
                  <span className="obs-error-stat-value success">{successRate.toFixed(1)}%</span>
                </div>
                <div className="obs-error-stat">
                  <span className="obs-error-stat-label">Total Errors</span>
                  <span className="obs-error-stat-value error">{Math.round(totalErrors)}</span>
                </div>
                <div className="obs-error-stat">
                  <span className="obs-error-stat-label">Total Requests</span>
                  <span className="obs-error-stat-value">{Math.round(totalRequests)}</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={80}>
                <BarChart data={prepareChartData('http_errors_total')}>
                  <Bar dataKey="value" fill="hsl(0, 70%, 55%)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Uptime Card - WITH THRESHOLD */}
        <div className={`obs-metric-card uptime ${uptimeStatus}`}>
          <div className="obs-card-header">
            <div className="obs-card-icon-wrap">
              <Server size={20} />
            </div>
          </div>
          <div className="obs-card-body">
            <span className="obs-card-label">Uptime</span>
            <span className={`obs-card-value status-${uptimeStatus}`}>{uptimeValue}%</span>
            <span className="obs-card-sub">
              SLA Target: {THRESHOLDS.uptime.good}%
              {uptimeStatus !== 'good' && <span className="obs-threshold-warning"> · Below SLA</span>}
            </span>
          </div>
          <div className="obs-uptime-ring">
            <svg viewBox="0 0 36 36">
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="hsl(220, 12%, 18%)"
                strokeWidth="3"
              />
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke={uptimeStatus === 'good' ? 'hsl(160, 70%, 45%)' : uptimeStatus === 'warning' ? 'hsl(45, 90%, 50%)' : 'hsl(0, 70%, 55%)'}
                strokeWidth="3"
                strokeDasharray={`${uptimeValue}, 100`}
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="obs-metrics-charts">
        {/* Chart Controls */}
        <div className="obs-chart-controls">
          <div className="obs-chart-bucket-selector">
            <span>Window:</span>
            <select
              value={timeBucket}
              onChange={(e) => {
                setTimeBucket(Number(e.target.value));
                setChartPage(0);
              }}
              className="obs-bucket-select"
            >
              <option value={5}>Last 5 min</option>
              <option value={15}>Last 15 min</option>
              <option value={30}>Last 30 min</option>
              <option value={60}>Last 1 hour</option>
            </select>
          </div>
          <div className="obs-chart-nav">
            <button
              onClick={() => setChartPage(p => p + 1)}
              disabled={!chartData.canGoBack}
              className="obs-nav-btn"
              title="Show older data"
            >
              ← Older
            </button>
            <span className="obs-chart-page-info">
              {chartData.visibleData.length} of {chartData.totalPoints} points
            </span>
            <button
              onClick={() => setChartPage(p => Math.max(0, p - 1))}
              disabled={!chartData.canGoForward}
              className="obs-nav-btn"
              title="Show newer data"
            >
              Newer →
            </button>
          </div>
        </div>

        {/* Requests Chart */}
        <div className="obs-chart-container">
          <div className="obs-chart-header">
            <h4>Requests</h4>
            <span className="obs-chart-subtitle">{combinedChartData.length} data points</span>
          </div>
          {combinedChartData.length === 0 ? (
            <div className="obs-chart-empty">
              <span>📊</span>
              <p>No request data in selected window</p>
              <small>Try selecting a larger time window</small>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={combinedChartData}>
                <defs>
                  <linearGradient id="requestsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" vertical={false} />
                <XAxis dataKey="time" stroke="rgba(255, 255, 255, 0.3)" fontSize={11} tickLine={false} tick={{ fill: 'rgba(255, 255, 255, 0.5)' }} />
                <YAxis stroke="rgba(255, 255, 255, 0.3)" fontSize={11} tickLine={false} axisLine={false} tick={{ fill: 'rgba(255, 255, 255, 0.5)' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    color: 'var(--foreground)'
                  }}
                  itemStyle={{ color: 'var(--foreground)' }}
                  formatter={(value: number) => [`${value} requests`, 'Requests']}
                />
                <Area
                  type="monotone"
                  dataKey="requests"
                  stroke="var(--primary)"
                  fill="url(#requestsGradient)"
                  strokeWidth={2}
                  dot={{ fill: 'var(--primary)', strokeWidth: 2, r: 3 }}
                  activeDot={{ r: 6, stroke: 'var(--primary)', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Errors Chart */}
        <div className="obs-chart-container">
          <div className="obs-chart-header">
            <h4>Errors</h4>
            <span className="obs-chart-subtitle error">{Math.round(totalErrors)} total errors</span>
          </div>
          {combinedChartData.length === 0 ? (
            <div className="obs-chart-empty">
              <span>✅</span>
              <p>No errors in selected window</p>
              <small>Your services are running smoothly!</small>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={combinedChartData}>
                <defs>
                  <linearGradient id="errorsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--error)" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="var(--error)" stopOpacity={0.3} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" vertical={false} />
                <XAxis dataKey="time" stroke="rgba(255, 255, 255, 0.3)" fontSize={11} tickLine={false} tick={{ fill: 'rgba(255, 255, 255, 0.5)' }} />
                <YAxis stroke="rgba(255, 255, 255, 0.3)" fontSize={11} tickLine={false} axisLine={false} tick={{ fill: 'rgba(255, 255, 255, 0.5)' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    color: 'var(--foreground)'
                  }}
                  itemStyle={{ color: 'var(--foreground)' }}
                  formatter={(value: number) => [`${value} errors`, 'Errors']}
                />
                <Bar
                  dataKey="errors"
                  fill="url(#errorsGradient)"
                  name="Errors"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Custom/Business Metrics Section */}
      {Object.keys(metricsByName)
        .filter(name => !['http_requests_total', 'http_errors_total', 'http_response_time_seconds', 'up', 'scrape_duration_seconds', 'scrape_samples_scraped', 'scrape_series_added', 'scrape_samples_post_metric_relabeling'].includes(name))
        .length > 0 && (
          <div className="obs-metrics-section">
            <h4 className="obs-section-title">Business Metrics</h4>
            <div className="obs-metrics-charts">
              {Object.keys(metricsByName)
                .filter(name => !['http_requests_total', 'http_errors_total', 'http_response_time_seconds', 'up', 'scrape_duration_seconds', 'scrape_samples_scraped', 'scrape_series_added', 'scrape_samples_post_metric_relabeling'].includes(name))
                .sort()
                .map(metricName => {
                  const data = prepareChartData(metricName);
                  if (data.length === 0) return null;

                  // Heuristic: _total or _count usually means counters (Bar), others are gauges (Area)
                  const isCounter = metricName.endsWith('_total') || metricName.endsWith('_count');
                  const lastValue = data[data.length - 1]?.value || 0;
                  const totalValue = data.reduce((sum, d) => sum + d.value, 0);

                  return (
                    <div className="obs-chart-container" key={metricName}>
                      <div className="obs-chart-header">
                        <h4>{metricName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</h4>
                        <span className="obs-chart-subtitle">
                          {isCounter ? `Total: ${Math.round(totalValue)}` : `Last: ${typeof lastValue === 'number' ? lastValue.toFixed(2) : lastValue}`}
                        </span>
                      </div>
                      <ResponsiveContainer width="100%" height={200}>
                        {isCounter ? (
                          <BarChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 12%, 20%)" vertical={false} />
                            <XAxis dataKey="time" stroke="hsl(220, 10%, 45%)" fontSize={11} tickLine={false} />
                            <YAxis stroke="hsl(220, 10%, 45%)" fontSize={11} tickLine={false} axisLine={false} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'hsl(220, 15%, 10%)',
                                borderColor: 'hsl(140, 70%, 50%)',
                                borderRadius: '8px'
                              }}
                              formatter={(val: number) => [val, 'Count']}
                            />
                            <Bar dataKey="value" fill="hsl(140, 70%, 55%)" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        ) : (
                          <AreaChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 12%, 20%)" vertical={false} />
                            <XAxis dataKey="time" stroke="hsl(220, 10%, 45%)" fontSize={11} tickLine={false} />
                            <YAxis stroke="hsl(220, 10%, 45%)" fontSize={11} tickLine={false} axisLine={false} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'hsl(220, 15%, 10%)',
                                borderColor: 'hsl(280, 70%, 50%)',
                                borderRadius: '8px'
                              }}
                              formatter={(val: number) => [val, 'Value']}
                            />
                            <Area
                              type="monotone"
                              dataKey="value"
                              stroke="hsl(280, 70%, 60%)"
                              fill="hsl(280, 70%, 60%)"
                              fillOpacity={0.2}
                              strokeWidth={2}
                            />
                          </AreaChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
    </div>
  );
};

export default MetricsChart;

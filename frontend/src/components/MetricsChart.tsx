import React, { useEffect, useState, type ChangeEvent } from 'react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, AlertCircle, Clock, TrendingUp, Zap } from 'lucide-react';
import { API_BASE_URL } from '../config';
import './MetricsChart.css';

interface LokiMetric {
  timestamp: string;
  metric_name: string;
  value: string;
  labels: {
    [key: string]: string;
  };
}

interface MetricsChartProps {
  tenantId: string;
  refreshKey?: number;
}

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

  useEffect(() => {
    if (!tenantId) return;

    const fetchMetrics = async () => {
      setLoading(true);
      setError('');

      try {
        const hours = parseFloat(timeRange);
        const url = `${API_BASE_URL}/api/metrics?tenant_id=${tenantId}&hours=${hours}`;
        const response = await fetch(url);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        setMetrics(data.metrics || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch metrics');
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, [tenantId, refreshKey, timeRange]);

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

  // Prepare chart data for each metric type
  const prepareChartData = (metricName: string) => {
    const metricValues = metricsByName[metricName] || [];
    return metricValues
      .slice(0, 30)
      .reverse()
      .map(m => ({
        time: new Date(m.timestamp).toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit'
        }),
        value: parseFloat(m.value) || 0,
        fullTimestamp: m.timestamp
      }));
  };

  // Calculate stats
  const requestsData = metricsByName['http_requests_total'] || [];
  const errorsData = metricsByName['http_errors_total'] || [];
  const responseTimeData = metricsByName['http_response_time_seconds'] || [];

  const totalRequests = requestsData.reduce((sum, m) => sum + parseFloat(m.value), 0);
  const totalErrors = errorsData.reduce((sum, m) => sum + parseFloat(m.value), 0);
  const avgResponseTime = responseTimeData.length > 0
    ? (responseTimeData.reduce((sum, m) => sum + parseFloat(m.value), 0) / responseTimeData.length).toFixed(3)
    : '0.000';
  const errorRate = totalRequests > 0 ? ((totalErrors / totalRequests) * 100).toFixed(1) : '0.0';

  // Determine health status
  const healthStatus = parseFloat(errorRate) < 1 ? 'excellent' : parseFloat(errorRate) < 5 ? 'good' : 'warning';

  return (
    <div className="obs-metrics">
      {/* Header with Time Range */}
      <div className="obs-metrics-header">
        <div className="obs-metrics-title">
          <Activity size={20} />
          <h3>Service Metrics</h3>
          <span className={`obs-health-badge ${healthStatus}`}>
            {healthStatus === 'excellent' ? '● Excellent' : healthStatus === 'good' ? '● Good' : '⚠ Degraded'}
          </span>
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
      </div>

      {/* Stats Cards */}
      <div className="obs-metrics-cards">
        <div className="obs-metric-card requests">
          <div className="obs-card-icon-wrap">
            <TrendingUp size={20} />
          </div>
          <div className="obs-card-content">
            <span className="obs-card-label">Total Requests</span>
            <span className="obs-card-value">{Math.round(totalRequests).toLocaleString()}</span>
          </div>
        </div>

        <div className="obs-metric-card response-time">
          <div className="obs-card-icon-wrap">
            <Zap size={20} />
          </div>
          <div className="obs-card-content">
            <span className="obs-card-label">Avg Response</span>
            <span className="obs-card-value">{avgResponseTime}s</span>
          </div>
        </div>

        <div className={`obs-metric-card error-rate ${parseFloat(errorRate) > 5 ? 'warning' : ''}`}>
          <div className="obs-card-icon-wrap">
            <AlertCircle size={20} />
          </div>
          <div className="obs-card-content">
            <span className="obs-card-label">Error Rate</span>
            <span className="obs-card-value">{errorRate}%</span>
          </div>
        </div>

        <div className="obs-metric-card errors">
          <div className="obs-card-icon-wrap">
            <AlertCircle size={20} />
          </div>
          <div className="obs-card-content">
            <span className="obs-card-label">Total Errors</span>
            <span className="obs-card-value">{Math.round(totalErrors).toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="obs-metrics-charts">
        {/* Requests Chart */}
        {metricsByName['http_requests_total'] && (
          <div className="obs-chart-container">
            <div className="obs-chart-header">
              <h4>Request Volume</h4>
              <span className="obs-chart-subtitle">{prepareChartData('http_requests_total').length} data points</span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={prepareChartData('http_requests_total')}>
                <defs>
                  <linearGradient id="requestsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(210 80% 55%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(210 80% 55%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 12% 18%)" vertical={false} />
                <XAxis dataKey="time" stroke="hsl(220 10% 40%)" fontSize={11} tickLine={false} />
                <YAxis stroke="hsl(220 10% 40%)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(220 12% 12%)',
                    border: '1px solid hsl(220 12% 20%)',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                  }}
                  labelStyle={{ color: 'hsl(220 10% 70%)' }}
                  itemStyle={{ color: 'hsl(210 80% 55%)' }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(210 80% 55%)"
                  strokeWidth={2}
                  fill="url(#requestsGradient)"
                  name="Requests"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Response Time Chart */}
        {metricsByName['http_response_time_seconds'] && (
          <div className="obs-chart-container">
            <div className="obs-chart-header">
              <h4>Response Time</h4>
              <span className="obs-chart-subtitle">seconds</span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={prepareChartData('http_response_time_seconds')}>
                <defs>
                  <linearGradient id="responseGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(160 70% 45%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(160 70% 45%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 12% 18%)" vertical={false} />
                <XAxis dataKey="time" stroke="hsl(220 10% 40%)" fontSize={11} tickLine={false} />
                <YAxis stroke="hsl(220 10% 40%)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(220 12% 12%)',
                    border: '1px solid hsl(220 12% 20%)',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                  }}
                  labelStyle={{ color: 'hsl(220 10% 70%)' }}
                  itemStyle={{ color: 'hsl(160 70% 45%)' }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(160 70% 45%)"
                  strokeWidth={2}
                  fill="url(#responseGradient)"
                  name="Response Time"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Errors Chart */}
        {metricsByName['http_errors_total'] && (
          <div className="obs-chart-container">
            <div className="obs-chart-header">
              <h4>Errors</h4>
              <span className="obs-chart-subtitle">count</span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={prepareChartData('http_errors_total')}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 12% 18%)" vertical={false} />
                <XAxis dataKey="time" stroke="hsl(220 10% 40%)" fontSize={11} tickLine={false} />
                <YAxis stroke="hsl(220 10% 40%)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(220 12% 12%)',
                    border: '1px solid hsl(220 12% 20%)',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                  }}
                  labelStyle={{ color: 'hsl(220 10% 70%)' }}
                  itemStyle={{ color: 'hsl(0 70% 55%)' }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(0 70% 55%)"
                  strokeWidth={2}
                  dot={{ fill: 'hsl(0 70% 55%)', r: 3 }}
                  name="Errors"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};

export default MetricsChart;

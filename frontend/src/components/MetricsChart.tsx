import React, { useEffect, useState } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Activity, AlertCircle, Clock, X } from 'lucide-react';
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

const MetricsChart: React.FC<MetricsChartProps> = ({ tenantId, refreshKey }) => {
  const [metrics, setMetrics] = useState<LokiMetric[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!tenantId) return;

    const fetchMetrics = async () => {
      setLoading(true);
      setError('');

      try {
        const url = `http://localhost:5001/api/metrics?tenant_id=${tenantId}`;
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
  }, [tenantId, refreshKey]);

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
        <p>No metrics available for this tenant</p>
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
      .slice(0, 20)
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

  const totalRequests = requestsData.length > 0 ? parseFloat(requestsData[0].value) : 0;
  const totalErrors = errorsData.length > 0 ? parseFloat(errorsData[0].value) : 0;
  const avgResponseTime = responseTimeData.length > 0
    ? (responseTimeData.reduce((sum, m) => sum + parseFloat(m.value), 0) / responseTimeData.length).toFixed(3)
    : '0.000';
  const errorRate = totalRequests > 0 ? ((totalErrors / totalRequests) * 100).toFixed(1) : '0.0';

  const chartStyle = {
    backgroundColor: 'hsl(220 12% 10%)',
    border: '1px solid hsl(220 12% 18%)',
    borderRadius: '8px'
  };

  return (
    <div className="obs-metrics">
      {/* Stats Cards */}
      <div className="obs-metrics-cards">
        <div className="obs-metric-card">
          <div className="obs-metric-card-header">
            <Activity className="obs-card-icon" />
            <span>Total Requests</span>
          </div>
          <div className="obs-metric-card-value">{totalRequests.toLocaleString()}</div>
        </div>

        <div className="obs-metric-card">
          <div className="obs-metric-card-header">
            <AlertCircle className="obs-card-icon" />
            <span>Error Rate</span>
          </div>
          <div className={`obs-metric-card-value ${parseFloat(errorRate) > 5 ? 'error' : 'success'}`}>
            {errorRate}%
          </div>
        </div>

        <div className="obs-metric-card">
          <div className="obs-metric-card-header">
            <Clock className="obs-card-icon" />
            <span>Avg Response Time</span>
          </div>
          <div className="obs-metric-card-value">{avgResponseTime}s</div>
        </div>

        <div className="obs-metric-card">
          <div className="obs-metric-card-header">
            <X className="obs-card-icon" />
            <span>Total Errors</span>
          </div>
          <div className="obs-metric-card-value error">{totalErrors.toLocaleString()}</div>
        </div>
      </div>

      {/* Charts */}
      <div className="obs-metrics-charts">
        {/* Requests Chart */}
        {metricsByName['http_requests_total'] && (
          <div className="obs-chart-container">
            <h3>HTTP Requests Over Time</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={prepareChartData('http_requests_total')}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 12% 18%)" />
                <XAxis dataKey="time" stroke="hsl(220 10% 50%)" />
                <YAxis stroke="hsl(220 10% 50%)" />
                <Tooltip
                  contentStyle={chartStyle}
                  labelStyle={{ color: 'hsl(40 10% 92%)' }}
                />
                <Legend />
                <Line type="monotone" dataKey="value" stroke="hsl(210 80% 55%)" strokeWidth={2} dot={{ fill: 'hsl(210 80% 55%)' }} name="Requests" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Response Time Chart */}
        {metricsByName['http_response_time_seconds'] && (
          <div className="obs-chart-container">
            <h3>Response Time (seconds)</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={prepareChartData('http_response_time_seconds')}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 12% 18%)" />
                <XAxis dataKey="time" stroke="hsl(220 10% 50%)" />
                <YAxis stroke="hsl(220 10% 50%)" />
                <Tooltip
                  contentStyle={chartStyle}
                  labelStyle={{ color: 'hsl(40 10% 92%)' }}
                />
                <Legend />
                <Bar dataKey="value" fill="hsl(160 70% 45%)" name="Response Time" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Errors Chart */}
        {metricsByName['http_errors_total'] && (
          <div className="obs-chart-container">
            <h3>Errors Over Time</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={prepareChartData('http_errors_total')}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 12% 18%)" />
                <XAxis dataKey="time" stroke="hsl(220 10% 50%)" />
                <YAxis stroke="hsl(220 10% 50%)" />
                <Tooltip
                  contentStyle={chartStyle}
                  labelStyle={{ color: 'hsl(40 10% 92%)' }}
                />
                <Legend />
                <Line type="monotone" dataKey="value" stroke="hsl(0 70% 55%)" strokeWidth={2} dot={{ fill: 'hsl(0 70% 55%)' }} name="Errors" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};

export default MetricsChart;

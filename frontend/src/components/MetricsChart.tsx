"use client"

import type React from "react"
import { useEffect, useState } from "react"
import "./MetricsChart.css"

interface Metric {
  metric: {
    __name__: string
    endpoint: string
    status: string
  }
  value: [number, string]
}

interface EndpointStat {
  total: number
  success: number
  error: number
}

interface MetricsChartProps {
  tenantId: string
  refreshKey?: number
}

const MetricsChart: React.FC<MetricsChartProps> = ({ tenantId, refreshKey }) => {
  const [metrics, setMetrics] = useState<Metric[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string>("")

  useEffect(() => {
    if (!tenantId) return

    const fetchMetrics = async () => {
      setLoading(true)
      setError("")

      try {
        const response = await fetch(`http://localhost:5001/api/metrics?tenant_id=${tenantId}`)
        if (!response.ok) throw new Error("Failed to fetch metrics")
        const data = await response.json()
        setMetrics(data.metrics || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch metrics")
      } finally {
        setLoading(false)
      }
    }

    fetchMetrics()
    const interval = setInterval(fetchMetrics, 15000)
    return () => clearInterval(interval)
  }, [tenantId, refreshKey])

  if (loading && metrics.length === 0) {
    return (
      <div className="obs-metrics-loading">
        <div className="obs-loading-spinner" />
        <span>Loading metrics...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="obs-metrics-error">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        {error}
      </div>
    )
  }

  const totalRequests = metrics.reduce((sum, m) => sum + Number.parseInt(m.value[1]), 0)
  const successCount = metrics
    .filter((m) => m.metric.status === "200" || m.metric.status === "201")
    .reduce((sum, m) => sum + Number.parseInt(m.value[1]), 0)
  const errorCount = metrics
    .filter((m) => m.metric.status === "400" || m.metric.status === "500")
    .reduce((sum, m) => sum + Number.parseInt(m.value[1]), 0)

  const endpointStats = metrics.reduce(
    (acc, m) => {
      const endpoint = m.metric.endpoint
      if (!acc[endpoint]) {
        acc[endpoint] = { total: 0, success: 0, error: 0 }
      }
      const count = Number.parseInt(m.value[1])
      acc[endpoint].total += count

      if (m.metric.status === "200" || m.metric.status === "201") {
        acc[endpoint].success += count
      } else if (m.metric.status === "400" || m.metric.status === "500") {
        acc[endpoint].error += count
      }
      return acc
    },
    {} as Record<string, EndpointStat>,
  )

  return (
    <div className="obs-metrics">
      <div className="obs-metrics-grid">
        <div className="obs-metric-card">
          <div className="obs-metric-icon obs-icon-total">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <div className="obs-metric-content">
            <span className="obs-metric-label">Total Requests</span>
            <span className="obs-metric-value">{totalRequests.toLocaleString()}</span>
          </div>
        </div>
        <div className="obs-metric-card">
          <div className="obs-metric-icon obs-icon-success">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className="obs-metric-content">
            <span className="obs-metric-label">Successful</span>
            <span className="obs-metric-value obs-value-success">{successCount.toLocaleString()}</span>
          </div>
        </div>
        <div className="obs-metric-card">
          <div className="obs-metric-icon obs-icon-error">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>
          <div className="obs-metric-content">
            <span className="obs-metric-label">Errors</span>
            <span className="obs-metric-value obs-value-error">{errorCount.toLocaleString()}</span>
          </div>
        </div>
        <div className="obs-metric-card">
          <div className="obs-metric-icon obs-icon-endpoints">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            </svg>
          </div>
          <div className="obs-metric-content">
            <span className="obs-metric-label">Endpoints</span>
            <span className="obs-metric-value">{Object.keys(endpointStats).length}</span>
          </div>
        </div>
      </div>

      <div className="obs-metrics-table-wrapper">
        <table className="obs-metrics-table">
          <thead>
            <tr>
              <th>Endpoint</th>
              <th>Total</th>
              <th>Success</th>
              <th>Errors</th>
              <th>Success Rate</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(endpointStats).map(([endpoint, stats]) => {
              const successRate = stats.total > 0 ? ((stats.success / stats.total) * 100).toFixed(1) : "0.0"
              const rateClass =
                Number.parseFloat(successRate) >= 95
                  ? "obs-rate-excellent"
                  : Number.parseFloat(successRate) >= 80
                    ? "obs-rate-good"
                    : "obs-rate-warning"
              return (
                <tr key={endpoint}>
                  <td className="obs-endpoint-cell">
                    <code>{endpoint}</code>
                  </td>
                  <td>{stats.total.toLocaleString()}</td>
                  <td className="obs-success-cell">{stats.success.toLocaleString()}</td>
                  <td className="obs-error-cell">{stats.error.toLocaleString()}</td>
                  <td>
                    <div className="obs-rate-wrapper">
                      <div className="obs-rate-bar">
                        <div className={`obs-rate-fill ${rateClass}`} style={{ width: `${successRate}%` }} />
                      </div>
                      <span className={`obs-rate-value ${rateClass}`}>{successRate}%</span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default MetricsChart

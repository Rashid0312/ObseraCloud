"use client"

import type React from "react"
import { useEffect, useState } from "react"
import "./TracesPanel.css"

interface Trace {
  traceID: string
  rootTraceName: string
  rootServiceName: string
  startTimeUnixNano: string
  durationMs: number
}

interface TracesPanelProps {
  tenantId: string
  refreshKey?: number
}

const TracesPanel: React.FC<TracesPanelProps> = ({ tenantId, refreshKey }) => {
  const [traces, setTraces] = useState<Trace[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string>("")

  useEffect(() => {
    if (!tenantId) return

    const fetchTraces = async () => {
      setLoading(true)
      setError("")

      try {
        const response = await fetch(`http://localhost:5001/api/traces/search?tenant_id=${tenantId}&limit=20`)
        if (!response.ok) throw new Error("Failed to fetch traces")
        const data = await response.json()
        setTraces(data.traces || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch traces")
      } finally {
        setLoading(false)
      }
    }

    fetchTraces()
    const interval = setInterval(fetchTraces, 15000)
    return () => clearInterval(interval)
  }, [tenantId, refreshKey])

  const formatTimestamp = (nanoTime: string): string => {
    const ms = Number.parseInt(nanoTime) / 1000000
    return new Date(ms).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
  }

  const getDurationClass = (ms: number): string => {
    if (ms < 100) return "obs-duration-fast"
    if (ms < 500) return "obs-duration-medium"
    return "obs-duration-slow"
  }

  if (loading && traces.length === 0) {
    return (
      <div className="obs-traces-loading">
        <div className="obs-loading-spinner" />
        <span>Loading traces...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="obs-traces-error">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        {error}
      </div>
    )
  }

  return (
    <div className="obs-traces-panel">
      <div className="obs-traces-header">
        <div className="obs-traces-info">
          <span className="obs-traces-count">{traces.length} traces</span>
          <span className="obs-traces-period">Last 24 hours</span>
        </div>
      </div>

      <div className="obs-traces-table-wrapper">
        <table className="obs-traces-table">
          <thead>
            <tr>
              <th>Trace ID</th>
              <th>Operation</th>
              <th>Service</th>
              <th>Duration</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {traces.map((trace) => (
              <tr key={trace.traceID} className="obs-trace-row">
                <td>
                  <code className="obs-trace-id">{trace.traceID.substring(0, 16)}...</code>
                </td>
                <td className="obs-trace-operation">{trace.rootTraceName}</td>
                <td>
                  <span className="obs-trace-service">{trace.rootServiceName}</span>
                </td>
                <td>
                  <span className={`obs-duration-badge ${getDurationClass(trace.durationMs)}`}>
                    {trace.durationMs}ms
                  </span>
                </td>
                <td className="obs-trace-time">{formatTimestamp(trace.startTimeUnixNano)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default TracesPanel

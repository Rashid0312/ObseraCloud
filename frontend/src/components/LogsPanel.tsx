"use client"

import type React from "react"
import { useEffect, useState, type ChangeEvent } from "react"
import "./LogsPanel.css"

interface Log {
  timestamp: string
  level: string
  message: string
  service: string
}

interface LogsPanelProps {
  tenantId: string
  refreshKey?: number
  compact?: boolean
}

const LogsPanel: React.FC<LogsPanelProps> = ({ tenantId, refreshKey, compact }) => {
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string>("")
  const [filter, setFilter] = useState<string>("")
  const [search, setSearch] = useState<string>("")

  useEffect(() => {
    if (!tenantId) return

    const fetchLogs = async () => {
      setLoading(true)
      setError("")

      try {
        const response = await fetch(
          `http://localhost:5001/api/logs?tenant_id=${tenantId}&limit=${compact ? 10 : 50}${filter ? `&level=${filter}` : ""}`,
        )
        if (!response.ok) throw new Error("Failed to fetch logs")
        const data = await response.json()
        setLogs(data.logs || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch logs")
      } finally {
        setLoading(false)
      }
    }

    fetchLogs()
    const interval = setInterval(fetchLogs, 10000)
    return () => clearInterval(interval)
  }, [tenantId, filter, refreshKey, compact])

  const getLevelClass = (level: string): string => {
    switch (level) {
      case "ERROR":
        return "obs-level-error"
      case "WARN":
        return "obs-level-warn"
      case "INFO":
        return "obs-level-info"
      default:
        return "obs-level-debug"
    }
  }

  const filteredLogs = logs.filter((log) => search === "" || log.message.toLowerCase().includes(search.toLowerCase()))

  if (loading && logs.length === 0) {
    return (
      <div className="obs-logs-loading">
        <div className="obs-loading-spinner" />
        <span>Loading logs...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="obs-logs-error">
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
    <div className={`obs-logs-panel ${compact ? "obs-logs-compact" : ""}`}>
      {!compact && (
        <div className="obs-logs-toolbar">
          <div className="obs-logs-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
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
          <div key={index} className="obs-log-entry">
            <span className="obs-log-time">
              {new Date(log.timestamp).toLocaleTimeString("en-US", {
                hour12: false,
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
            <span className={`obs-log-level ${getLevelClass(log.level)}`}>{log.level}</span>
            <span className="obs-log-service">{log.service}</span>
            <span className="obs-log-message">{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default LogsPanel

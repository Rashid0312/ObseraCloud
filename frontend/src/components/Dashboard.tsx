"use client"

import type React from "react"

import { useState, useEffect } from "react"
import LogsPanel from "./LogsPanel"
import MetricsChart from "./MetricsChart"
import TracesPanel from "./TracesPanel"
import "./Dashboard.css"

const Dashboard = () => {
  const [tenantId, setTenantId] = useState<string>("")
  const [tenantName, setTenantName] = useState<string>("")
  const [activeView, setActiveView] = useState<"logs" | "metrics" | "traces">("logs")
  const [expandedGroups, setExpandedGroups] = useState<string[]>(["telemetry"])
  const [refreshKey, setRefreshKey] = useState<number>(0)

  useEffect(() => {
    const storedTenantId = localStorage.getItem("tenant_id")
    const storedTenantName = localStorage.getItem("tenant_name")
    if (storedTenantId) setTenantId(storedTenantId)
    if (storedTenantName) setTenantName(storedTenantName)
  }, [])

  const handleLogout = () => {
    localStorage.removeItem("tenant_id")
    localStorage.removeItem("tenant_name")
    window.location.reload()
  }

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1)
  }

  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) => (prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]))
  }

  const telemetryItems = [
    { id: "logs", label: "Logs" },
    { id: "metrics", label: "Metrics" },
    { id: "traces", label: "Traces" },
  ]

  return (
    <div className="obs-dashboard">
      {/* Sidebar */}
      <aside className="obs-sidebar">
        <div className="obs-sidebar-header">
          <div className="obs-sidebar-logo">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="obs-sidebar-title">SkyView</span>
        </div>

        <nav className="obs-sidebar-nav">
          <div className="obs-nav-group">
            <div className="obs-nav-group-header active" onClick={() => toggleGroup("telemetry")}>
              <div className="obs-nav-group-left">
                <NavIcon name="activity" />
                <span>Telemetry</span>
              </div>
              <svg
                className={`obs-nav-group-arrow ${expandedGroups.includes("telemetry") ? "expanded" : ""}`}
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </div>
            {expandedGroups.includes("telemetry") && (
              <div className="obs-nav-subitems">
                {telemetryItems.map((item) => (
                  <div
                    key={item.id}
                    className={`obs-nav-subitem ${activeView === item.id ? "active" : ""}`}
                    onClick={() => setActiveView(item.id as "logs" | "metrics" | "traces")}
                  >
                    {item.label}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="obs-nav-section">
            <button className="obs-nav-item">
              <NavIcon name="layout" />
              <span>Dashboards</span>
            </button>
          </div>

          <div className="obs-nav-section">
            <button className="obs-nav-item">
              <NavIcon name="bell" />
              <span>Alerts</span>
            </button>
          </div>
        </nav>

        <div className="obs-sidebar-footer">
          <div
            className="obs-tenant-badge"
            onClick={handleLogout}
            style={{ cursor: "pointer" }}
            title="Click to logout"
          >
            <span className="obs-tenant-dot"></span>
            <span>{tenantName || "Tenant"}</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="obs-main">
        {/* Header */}
        <header className="obs-header">
          <div className="obs-header-left">
            <h1 className="obs-page-title">
              {activeView === "logs" && "Logs"}
              {activeView === "metrics" && "Metrics"}
              {activeView === "traces" && "Traces"}
            </h1>
            <span className="obs-tenant-label">{tenantName || tenantId}</span>
          </div>

          <div className="obs-header-right">
            <button className="obs-refresh-btn" onClick={handleRefresh} title="Refresh data">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 4v6h-6M1 20v-6h6" />
                <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
              </svg>
              Refresh
            </button>
            <button className="obs-logout-btn" onClick={handleLogout}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Logout
            </button>
          </div>
        </header>

        {/* View Tabs */}
        <div className="obs-view-tabs">
          <button
            className={`obs-view-tab ${activeView === "logs" ? "active" : ""}`}
            onClick={() => setActiveView("logs")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
            Logs
          </button>
          <button
            className={`obs-view-tab ${activeView === "metrics" ? "active" : ""}`}
            onClick={() => setActiveView("metrics")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            Metrics
          </button>
          <button
            className={`obs-view-tab ${activeView === "traces" ? "active" : ""}`}
            onClick={() => setActiveView("traces")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
            Traces
          </button>
        </div>

        {/* Content */}
        <div className="obs-content">
          {activeView === "logs" && <LogsPanel tenantId={tenantId} refreshKey={refreshKey} />}
          {activeView === "metrics" && <MetricsChart tenantId={tenantId} refreshKey={refreshKey} />}
          {activeView === "traces" && <TracesPanel tenantId={tenantId} refreshKey={refreshKey} />}
        </div>
      </main>
    </div>
  )
}

const NavIcon = ({ name }: { name: string }): React.ReactElement | null => {
  const icons: Record<string, React.ReactElement> = {
    activity: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
    layout: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="9" y1="21" x2="9" y2="9" />
      </svg>
    ),
    bell: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 01-3.46 0" />
      </svg>
    ),
  }
  return icons[name] || null
}

export default Dashboard

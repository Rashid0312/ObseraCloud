# ObseraCloud 🔭

**Distributed Observability Platform for the Modern Cloud**

ObseraCloud is a full-stack, distributed observability platform engineered to unify logs, metrics, and traces into a single correlated interface. Built with a polyglot microservices architecture, it bridges the gap between high-performance data ingestion and actionable business intelligence.

![Premium Silver Theme](https://img.shields.io/badge/Theme-Premium%20Silver-silver)
![Go](https://img.shields.io/badge/Ingestion-Go-00ADD8)
![Python](https://img.shields.io/badge/Backend-Python-yellow)
![ClickHouse](https://img.shields.io/badge/Storage-ClickHouse-FFCC00)
![React](https://img.shields.io/badge/Frontend-React%20%2B%20TypeScript-blue)

> **🚧 Note: This project is a functional Proof of Concept (POC) designed to demonstrate distributed observability patterns. It is not intended for production use.**

---

## 🏗 System Architecture

ObseraCloud replaces siloed monitoring tools with a unified pipeline designed for scale.

### 1. High-Performance Ingestion (Go)
*   **Role**: The front-line gatekeeper for all telemetry data.
*   **Tech**: Built in **Go** for its superior concurrency model.
*   **Function**: Buffers and batches high-throughput log and trace streams before they hit the storage layer, ensuring zero data loss during traffic spikes.

### 2. Optimized Storage Engine (ClickHouse & PostgreSQL)
*   **Logs & Metrics**: stored in **ClickHouse**. Its columnar nature allows for sub-second aggregations over millions of rows.
*   **Relational Data**: Tenant metadata, user sessions, and configurations are managed by **PostgreSQL** for strict consistency.

### 3. Intelligence Layer (Python)
*   **Role**: The analytical brain.
*   **Tech**: **Python** microservices.
*   **Function**: Handles complex data normalization, health checking, and runs the AI-driven context engine to correlate failures across services.

### 4. Real-Time Visualization (React & TypeScript)
*   **Role**: The single pane of glass.
*   **Tech**: **React**, **TypeScript**, **WebSockets**.
*   **Function**: A responsive dashboard that visualizes distributed traces as Gantt charts and streams live logs with millisecond latency.

---

## ✨ Key Capabilities

*   **Distributed Tracing Gateway**: An OpenTelemetry-compatible collector that tags every request, allowing you to trace a user click through to the database query.
*   **Unified Data Model**: Logs are automatically linked to traces. (e.g., View a trace -> Click a span -> See the logs for that exact microsecond).
*   **Multi-Tenancy**: Built from the ground up for shared infrastructure, with strict logical isolation at the database level.
*   **Performance First**: Designed to handle ingestion backpressure without stalling the read path.

---

## 🚀 Quick Start

### Prerequisites
*   Docker & Docker Compose
*   Node.js 18+ (local dev)
*   Go 1.20+ (local dev)

### Run with Docker

```bash
# Clone the repository
git clone https://github.com/yourusername/ObseraCloud.git
cd ObseraCloud

# Start the full stack (Ingestion, Storage, UI)
docker-compose up -d

# Access the dashboard
open http://localhost:3001
```

### Demo Credentials
| Tenant ID | Role | Password |
|-----------|------|----------|
| `acme`    | Admin| `demo123`|

---

## 📁 Project Structure

```
ObseraCloud/
├── otel-collector/        # Go-based Ingestion Gateway
├── backend/               # Python (Flask) Analytical Engine
├── frontend/              # (React + TypeScript) Dashboard
├── clickhouse/            # Columnar Storage Config
├── loki/                  # Log Aggregation Config
└── docker-compose.yml     # Orchestration
```

---

## � Security

*   **JWT Authentication**: Stateless, secure session management.
*   **Role-Based Access Control (RBAC)**: Granular permissions per tenant.
*   **Security Headers**: Automated protections against XSS and injection attacks.

---

## 🤝 Contributing

This is an open engineering effort. We welcome contributions in Go (Ingestion), Python (Backend), or React (Frontend).

1.  Fork the repository
2.  Create a feature branch (`git checkout -b feature/amazing-feature`)
3.  Commit your changes
4.  Push to the branch
5.  Open a Pull Request

---

**Built with engineering pride using OpenTelemetry, ClickHouse, and Go.**

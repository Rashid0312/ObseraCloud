# ObseraCloud Future Features - To Do List

## Priority 1 - User Acquisition Features
*Implement when you have users on the server*

### [ ] Containerize Health Checker
- Create Dockerfile for `backend/health_checker.py`
- Add to `docker-compose.yml` with `restart: unless-stopped`
- Add required database tables (service_endpoints, health_checks, outages)
- Runs automatically, checks endpoints every 30 seconds
- **Estimated time:** 1 hour

### [ ] Notification/Alerting System
- Slack webhook integration for outage alerts
- Email notifications (SendGrid/SMTP)
- SMS alerts via Twilio (optional)
- Alert rules: outage start, outage resolved, degraded performance
- Configurable per-tenant notification preferences
- **Estimated time:** 4-6 hours

---

## Priority 2 - Business Features

### [ ] SLA Reports & Error Budgets
- Monthly uptime percentage reports
- Error budget tracking (e.g., 99.9% = 43 min downtime/month)
- PDF export for customers
- **Estimated time:** 4-6 hours

### [ ] Multi-Region Probes
- Check endpoints from multiple locations (EU, US, Asia)
- Show latency by region
- Requires external probe servers or cloud functions
- **Estimated time:** 8+ hours

### [ ] Billing/Subscription System
- Stripe integration
- Tiered pricing plans
- Usage-based billing
- **Estimated time:** 8+ hours

---

## Priority 3 - Nice to Have

### [ ] User Invite System
- Invite team members to tenant
- Role-based permissions (admin, viewer)

### [ ] Custom Dashboards
- Drag-and-drop dashboard builder
- Custom metric widgets

### [ ] Public Status Pages
- Per-tenant public status page
- Embed widget for customer websites

---

## Priority 4 - Enterprise Features (Differentiators)

### [ ] Cross-Telemetry Correlation
- Click from metric spike → related logs → trace
- Deep linking between telemetry types
- Unified timeline view showing metrics, logs, traces together
- Auto-correlate by trace_id across all data types
- **Value:** Major differentiator in modern observability tools

### [ ] Advanced Alerting & SLOs
- Define SLOs (e.g., 99.9% uptime, p99 latency < 500ms)
- Error budget tracking and visualization
- Alert rules: error rate > threshold, latency spikes, resource limits
- Alert routing: email, Slack, PagerDuty, webhooks
- Alert grouping and noise reduction
- **Value:** Key enterprise requirement

### Phase 2: Business Metrics support
### Planning Phase
- [x] Explore ObseraCloud architecture and understand ingestion patterns
- [x] Review auth gateway for API key validation flow
- [x] Create implementation plan for TournamentV3 instrumentation
- [x] Phase 2: Design dynamic business metrics visualization

### Execution Phase
- [x] Document OpenTelemetry configuration for Node.js + Express backend
- [x] Document frontend instrumentation with @opentelemetry/web
- [x] Provide environment variable configuration
- [x] Create sample instrumentation code
- [ ] Implement dynamic metric discovery in MetricsChart.tsx
- [ ] Update client documentation with business metric examples

### [ ] Integrations & Ingestion
- Easy OpenTelemetry SDK integration guides
- Pre-built agents for common frameworks (Node, Python, Go, Java)
- Cloud integrations: AWS CloudWatch, GCP Logging, Azure Monitor
- Kubernetes integration: auto-discovery, pod/container metrics
- One-click setup wizards per language/framework
- **Value:** Reduces barrier to adoption

### [ ] SSO & RBAC
- Single Sign-On: Google, GitHub, Okta, SAML
- Role-Based Access Control: Admin, Editor, Viewer
- Team management and permissions
- Audit logs for security compliance
- **Value:** Enterprise security requirement

-- Uptime Monitoring Schema for ObseraCloud
-- Run this migration to add uptime monitoring tables

-- Service endpoints to monitor per tenant
CREATE TABLE IF NOT EXISTS service_endpoints (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL,
    service_name VARCHAR(100) NOT NULL,
    endpoint_url TEXT NOT NULL,
    check_interval_seconds INTEGER DEFAULT 60,
    timeout_seconds INTEGER DEFAULT 10,
    expected_status_code INTEGER DEFAULT 200,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, service_name)
);

-- Individual health check results
CREATE TABLE IF NOT EXISTS health_checks (
    id SERIAL PRIMARY KEY,
    endpoint_id INTEGER REFERENCES service_endpoints(id) ON DELETE CASCADE,
    tenant_id VARCHAR(100) NOT NULL,
    service_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('up', 'down', 'degraded')),
    response_time_ms INTEGER,
    status_code INTEGER,
    error_message TEXT,
    checked_at TIMESTAMP DEFAULT NOW()
);

-- Detected outages
CREATE TABLE IF NOT EXISTS outages (
    id SERIAL PRIMARY KEY,
    endpoint_id INTEGER REFERENCES service_endpoints(id) ON DELETE CASCADE,
    tenant_id VARCHAR(100) NOT NULL,
    service_name VARCHAR(100) NOT NULL,
    started_at TIMESTAMP NOT NULL,
    ended_at TIMESTAMP,
    duration_seconds INTEGER,
    failure_count INTEGER DEFAULT 1,
    status VARCHAR(20) DEFAULT 'ongoing' CHECK (status IN ('ongoing', 'resolved')),
    root_cause TEXT,
    ai_analysis TEXT, -- AI-generated root cause analysis
    created_at TIMESTAMP DEFAULT NOW()
);

-- Aggregated uptime summaries (for fast dashboard queries)
CREATE TABLE IF NOT EXISTS uptime_summary (
    id SERIAL PRIMARY KEY,
    endpoint_id INTEGER REFERENCES service_endpoints(id) ON DELETE CASCADE,
    tenant_id VARCHAR(100) NOT NULL,
    service_name VARCHAR(100) NOT NULL,
    period_start TIMESTAMP NOT NULL,
    period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('hourly', 'daily', 'monthly')),
    total_checks INTEGER DEFAULT 0,
    successful_checks INTEGER DEFAULT 0,
    uptime_percentage DECIMAL(5,2),
    avg_response_ms INTEGER,
    min_response_ms INTEGER,
    max_response_ms INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(endpoint_id, period_start, period_type)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_health_checks_tenant_time ON health_checks(tenant_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_checks_endpoint_time ON health_checks(endpoint_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_outages_tenant_time ON outages(tenant_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_outages_status ON outages(status) WHERE status = 'ongoing';
CREATE INDEX IF NOT EXISTS idx_uptime_summary_tenant ON uptime_summary(tenant_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_uptime_summary_lookup ON uptime_summary(endpoint_id, period_type, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_service_endpoints_tenant ON service_endpoints(tenant_id);
CREATE INDEX IF NOT EXISTS idx_service_endpoints_active ON service_endpoints(is_active) WHERE is_active = TRUE;

-- Insert default monitoring endpoints for demo tenants
INSERT INTO service_endpoints (tenant_id, service_name, endpoint_url, check_interval_seconds) VALUES
    ('acme', 'API Gateway', 'http://localhost:5001/health', 60),
    ('acme', 'Web App', 'http://localhost:3001', 60),
    ('globex', 'API Gateway', 'http://localhost:5001/health', 60),
    ('initech', 'API Gateway', 'http://localhost:5001/health', 60),
    ('Tourni1010', 'TOurnament', 'https://tournament-v3.vercel.app/', 60),
    ('Tourni1010', 'api', 'https://tournament-v3.vercel.app/account', 60)
ON CONFLICT (tenant_id, service_name) DO NOTHING;

-- Function to calculate uptime percentage
CREATE OR REPLACE FUNCTION calculate_uptime(
    p_tenant_id VARCHAR(100),
    p_hours INTEGER DEFAULT 24
) RETURNS DECIMAL(5,2) AS $$
DECLARE
    total_checks INTEGER;
    up_checks INTEGER;
BEGIN
    SELECT 
        COUNT(*),
        SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END)
    INTO total_checks, up_checks
    FROM health_checks
    WHERE tenant_id = p_tenant_id
      AND checked_at > NOW() - (p_hours || ' hours')::INTERVAL;
    
    IF total_checks = 0 THEN
        RETURN 100.00;
    END IF;
    
    RETURN ROUND((up_checks::DECIMAL / total_checks) * 100, 2);
END;
$$ LANGUAGE plpgsql;

-- Status Pages Configuration
CREATE TABLE IF NOT EXISTS status_pages (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT TRUE,
    password_hash VARCHAR(255),
    requires_auth BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, slug),
    UNIQUE(slug) -- Public slugs must be globally unique for simplicity in this version
);

-- Link Monitors to Status Pages
CREATE TABLE IF NOT EXISTS status_page_monitors (
    status_page_id INTEGER REFERENCES status_pages(id) ON DELETE CASCADE,
    endpoint_id INTEGER REFERENCES service_endpoints(id) ON DELETE CASCADE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (status_page_id, endpoint_id)
);

CREATE INDEX IF NOT EXISTS idx_status_pages_slug ON status_pages(slug);

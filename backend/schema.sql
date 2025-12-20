-- backend/schema.sql
CREATE TABLE IF NOT EXISTS tenants (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(100) UNIQUE NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    api_key VARCHAR(64) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    plan VARCHAR(50) DEFAULT 'free'
);

CREATE INDEX IF NOT EXISTS idx_tenant_id ON tenants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_key ON tenants(api_key);

-- Demo tenant (password: demo123)
INSERT INTO tenants (tenant_id, company_name, email, password_hash, api_key) 
VALUES (
    'demo-tenant',
    'Demo Company',
    'demo@example.com',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5LS2LwgYLwLGy',
    'demo_api_key_12345'
) ON CONFLICT (tenant_id) DO NOTHING;

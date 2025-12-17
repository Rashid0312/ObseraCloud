-- Tenant metadata
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(255) UNIQUE,
    api_key VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users per tenant
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    password BYTEA NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, email)
);

-- API Keys for programmatic access
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    key_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

-- Usage tracking for billing
CREATE TABLE IF NOT EXISTS usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    metric_type VARCHAR(50), -- 'logs', 'metrics', 'traces'
    data_size_bytes BIGINT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Test data: Create two tenants
INSERT INTO tenants (name, subdomain, api_key) VALUES 
    ('Tenant A', 'tenant-a', 'key_tenant_a_12345'),
    ('Tenant B', 'tenant-b', 'key_tenant_b_67890')
ON CONFLICT DO NOTHING;

-- Create test users (password: password123 hashed with bcrypt)
-- In production, use bcrypt to hash passwords
INSERT INTO users (tenant_id, email, password) 
SELECT id, 'admin@tenant-a.local', '\x24322412243668726f61757656577a4659546c5265624742714f48506e4c4f484f6b5038495a54436f4a634c4a746876614e4f53' 
FROM tenants WHERE subdomain = 'tenant-a'
ON CONFLICT DO NOTHING;

INSERT INTO users (tenant_id, email, password) 
SELECT id, 'admin@tenant-b.local', '\x24322412243668726f61757656577a4659546c5265624742714f48506e4c4f484f6b5038495a54436f4a634c4a746876614e4f53' 
FROM tenants WHERE subdomain = 'tenant-b'
ON CONFLICT DO NOTHING;

-- Tenants table: stores customer accounts
CREATE TABLE IF NOT EXISTS tenants (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(50) UNIQUE NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    api_key VARCHAR(64) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Index for fast lookups
CREATE INDEX idx_tenants_email ON tenants(email);
CREATE INDEX idx_tenants_api_key ON tenants(api_key);
CREATE INDEX idx_tenants_tenant_id ON tenants(tenant_id);

-- Insert demo tenants (for testing)
INSERT INTO tenants (tenant_id, company_name, email, password_hash, api_key) VALUES
('tenant-acme', 'Acme Corp', 'admin@acme.com', '$2b$12$demo_hash_acme', 'sk_acme_demo_key_12345'),
('tenant-globex', 'Globex Industries', 'admin@globex.com', '$2b$12$demo_hash_globex', 'sk_globex_demo_key_67890'),
('tenant-initech', 'Initech Systems', 'admin@initech.com', '$2b$12$demo_hash_initech', 'sk_initech_demo_key_abcde')
ON CONFLICT (tenant_id) DO NOTHING;

-- ObseraCloud Database Schema

-- Tenants table (main user accounts)
CREATE TABLE IF NOT EXISTS tenants (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(255) UNIQUE NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    password_hash VARCHAR(255) NOT NULL,
    api_key VARCHAR(255) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin user (password: admin123)
INSERT INTO tenants (tenant_id, company_name, email, password_hash, api_key, is_active, is_admin) VALUES 
    ('admin', 'ObseraCloud Admin', 'admin@obsera.cloud', '$2b$12$4aO4aZhCACOZcGRALmZdY.FGgQgPZnsplhg1Sy8D8uQlGK7XreQmm', 'admin_key_super_secret_123', TRUE, TRUE)
ON CONFLICT (tenant_id) DO NOTHING;

-- Demo tenants (password: demo123)
INSERT INTO tenants (tenant_id, company_name, email, password_hash, api_key, is_active, is_admin) VALUES 
    ('acme', 'Acme Corporation', 'admin@acme.com', '$2b$12$YQeYhPOecgEVhVs3lRINruTI/dFTQquTlfKokGcgTNM5OOCsENmLW', 'acme_api_key_12345', TRUE, FALSE),
    ('globex', 'Globex Industries', 'admin@globex.com', '$2b$12$YQeYhPOecgEVhVs3lRINruTI/dFTQquTlfKokGcgTNM5OOCsENmLW', 'globex_api_key_67890', TRUE, FALSE),
    ('initech', 'Initech Corp', 'admin@initech.com', '$2b$12$YQeYhPOecgEVhVs3lRINruTI/dFTQquTlfKokGcgTNM5OOCsENmLW', 'initech_api_key_abcde', TRUE, FALSE),
    ('tourni1010', 'Tourni1010', 'admin@tourni.com', '$2b$12$1fYm0Q.BuF9pjoHqriz.HuptL756VOSOW73SoHTh0uQhxMUWmwGda', 'tourni1010_api_key_prod', TRUE, TRUE),
    ('rosetta-01', 'Rosetta Health', 'admin@rosetta.health', '$2b$12$YQeYhPOecgEVhVs3lRINruTI/dFTQquTlfKokGcgTNM5OOCsENmLW', 'rosetta_api_key_prod', TRUE, TRUE)
ON CONFLICT (tenant_id) DO UPDATE SET is_admin = EXCLUDED.is_admin;

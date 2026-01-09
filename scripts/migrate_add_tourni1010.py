#!/usr/bin/env python3
"""
Production Database Migration Script
Ensures Tourni1010 tenant exists in the database without requiring container restart.
Safe to run multiple times (idempotent).
"""

import os
import sys
import psycopg2
import bcrypt

# Database credentials from environment or defaults
DB_HOST = os.getenv("POSTGRES_HOST", "localhost")
DB_PORT = os.getenv("POSTGRES_PORT", "5432")
DB_NAME = os.getenv("POSTGRES_DB", "skyview")
DB_USER = os.getenv("POSTGRES_USER", "skyview_user")
DB_PASSWORD = os.getenv("POSTGRES_PASSWORD", "skyview_password")

DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

def migrate_database():
    """Add Tourni1010 tenant if missing"""
    print("=" * 60)
    print("🔄 SkyView Database Migration")
    print("=" * 60)
    
    try:
        # Connect to database
        print(f"\n📡 Connecting to database: {DB_HOST}:{DB_PORT}/{DB_NAME}...")
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        # Check if Tourni1010 exists
        cur.execute("SELECT EXISTS(SELECT 1 FROM tenants WHERE tenant_id = 'Tourni1010')")
        tourni_exists = cur.fetchone()[0]
        
        # Check if rosseta exists
        cur.execute("SELECT EXISTS(SELECT 1 FROM tenants WHERE tenant_id = 'rosseta')")
        rosseta_exists = cur.fetchone()[0]
        
        if tourni_exists and rosseta_exists:
            print("✅ Both Tourni1010 and rosseta tenants already exist. No migration needed.")
        else:
            if not tourni_exists:
                print("➕ Adding Tourni1010 tenant...")
                # Tourni1010 password: Broly1900
                password_hash = "$2b$12$1fYm0Q.BuF9pjoHqriz.HuptL756VOSOW73SoHTh0uQhxMUWmwGda"
                
                cur.execute("""
                    INSERT INTO tenants (tenant_id, company_name, email, password_hash, api_key, is_active)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (tenant_id) DO NOTHING
                """, ('Tourni1010', 'Tournament Platform', 'admin@tourni1010.com', 
                      password_hash, 'tourni1010_api_key_prod', True))
                print("  ✅ Tourni1010 added!")
            
            if not rosseta_exists:
                print("➕ Adding rosseta tenant...")
                # rosseta password: demo123
                password_hash = "$2b$12$YQeYhPOecgEVhVs3lRINruTI/dFTQquTlfKokGcgTNM5OOCsENmLW"
                
                cur.execute("""
                    INSERT INTO tenants (tenant_id, company_name, email, password_hash, api_key, is_active)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (tenant_id) DO NOTHING
                """, ('rosseta', 'Rosseta Client', 'admin@rosseta.com', 
                      password_hash, 'rosseta_api_key_prod', True))
                print("  ✅ rosseta added!")
            
            conn.commit()
        
        # Show all tenants
        print("\n📋 Current Tenants:")
        cur.execute("SELECT tenant_id, company_name, is_active FROM tenants ORDER BY created_at")
        for row in cur.fetchall():
            status = "✓" if row[2] else "✗"
            print(f"  {status} {row[0]:15s} - {row[1]}")
        
        cur.close()
        conn.close()
        
        print("\n" + "=" * 60)
        print("✅ Migration completed successfully!")
        print("=" * 60)
        return True
        
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        return False

if __name__ == "__main__":
    success = migrate_database()
    sys.exit(0 if success else 1)

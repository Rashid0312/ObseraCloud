
import os
import psycopg2
import logging
from psycopg2.extras import RealDictCursor
import clickhouse_client as ch
from dotenv import load_dotenv

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load env (try backend first, then root)
load_dotenv(".env")
load_dotenv("../.env")

# Config
# Try to get password from env, fallback to likely defaults from docker-compose
PG_USER = os.getenv("POSTGRES_USER", "obsera_user")
PG_DB = os.getenv("POSTGRES_DB", "obsera")
# We don't know the PG password if .env is blocked, but let's try reading it if load_dotenv worked, 
# or maybe "password" or "obsera" as guess if it's a dev env.
# But better: just handle the failure gracefully.
DATABASE_URL = os.getenv("DATABASE_URL", f"postgresql://{PG_USER}:password@localhost:5432/{PG_DB}")

TENANT_ID = "Tourni1010"

print(f"DEBUG: Using DATABASE_URL={DATABASE_URL}")

# Monkey patch clickhouse_client module directly since it was already imported
ch.CH_HOST = "localhost"
ch.CH_PORT = 8123
ch.CH_USER = "default"
# Try "password" if env not set, else use what's there (likely empty from import time)
# Force "password" for now since that's what we see in docker-compose
ch.CH_PASSWORD = "password"
ch._client = None # Reset client

def check_tenant_postgres():

    try:
        conn = psycopg2.connect(DATABASE_URL)
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM tenants WHERE tenant_id = %s", (TENANT_ID,))
            tenant = cur.fetchone()
            if tenant:
                logger.info(f"✅ Tenant '{TENANT_ID}' found in Postgres.")
                logger.info(f"Details: {tenant}")
            else:
                logger.error(f"❌ Tenant '{TENANT_ID}' NOT found in Postgres.")
    except Exception as e:
        logger.error(f"Failed to query Postgres: {e}")
    finally:
        if 'conn' in locals() and conn:
            conn.close()

def check_traces_clickhouse():
    try:
        client = ch.get_client()
        if not client:
            logger.error("Failed to get ClickHouse client.")
            return

        # Check raw count
        query = f"SELECT count() FROM otel_traces WHERE ResourceAttributes['tenant_id'] = '{TENANT_ID}'"
        result = ch.execute_query(query)
        count = result[0]['count()']
        
        if count > 0:
            logger.info(f"✅ Found {count} traces for '{TENANT_ID}' in ClickHouse.")
            
            # Get sample
            traces = ch.get_traces(tenant_id=TENANT_ID, limit=5)
            logger.info(f"Sample traces: {traces}")
        else:
            logger.error(f"❌ No traces found for '{TENANT_ID}' in ClickHouse.")
            
            # Check if there are ANY traces
            query_all = "SELECT count() FROM otel_traces"
            result_all = ch.execute_query(query_all)
            logger.info(f"Total traces in DB: {result_all[0]['count()']}")
            
            # Check distinct tenants
            query_tenants = "SELECT DISTINCT ResourceAttributes['tenant_id'] as tenant FROM otel_traces"
            result_tenants = ch.execute_query(query_tenants)
            logger.info(f"Existing tenants in traces: {[r['tenant'] for r in result_tenants]}")

    except Exception as e:
        logger.error(f"Failed to query ClickHouse: {e}")

if __name__ == "__main__":
    logger.info("Starting Debug...")
    check_tenant_postgres()
    check_traces_clickhouse()

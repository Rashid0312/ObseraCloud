#!/usr/bin/env python3
"""
Health Checker Background Worker for ObseraCloud
Periodically checks service endpoints and records health status.
"""

import os
import time
import signal
import sys
import logging
import requests
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
import clickhouse_client
import ai_agent

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('health_checker')

# Database configuration - supports both Docker and local environments
# For Docker: use container name as host
# For local: use localhost with exposed port
DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql://skyview_user:skyview_password@host.docker.internal:5432/skyview"
)

# Fallback for running outside Docker - try direct container connection
def get_database_url():
    """Get the correct database URL based on environment"""
    url = os.getenv("DATABASE_URL")
    if url:
        return url
    # Try localhost first (for running scripts outside Docker)
    return "postgresql://skyview_user:skyview_password@localhost:5432/skyview"

DATABASE_URL = get_database_url()

# Health check configuration
CHECK_BATCH_SIZE = 50  # Max concurrent checks
OUTAGE_THRESHOLD = 3   # Consecutive failures to declare outage
DEFAULT_TIMEOUT = 10   # Default request timeout in seconds

# Graceful shutdown
running = True

def signal_handler(sig, frame):
    global running
    logger.info("Shutdown signal received, stopping...")
    running = False

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)


def get_db_connection():
    """Create a database connection."""
    try:
        conn = psycopg2.connect(DATABASE_URL)
        return conn
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        return None


def get_active_endpoints(conn):
    """Fetch all active service endpoints to check."""
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT id, tenant_id, service_name, endpoint_url, 
                       check_interval_seconds, timeout_seconds, expected_status_code
                FROM service_endpoints 
                WHERE is_active = TRUE
            """)
            return cur.fetchall()
    except Exception as e:
        logger.error(f"Failed to fetch endpoints: {e}")
        return []


def check_endpoint(endpoint):
    """
    Check a single endpoint's health.
    Returns: dict with status, response_time_ms, status_code, error_message
    """
    start_time = time.time()
    timeout = endpoint.get('timeout_seconds', DEFAULT_TIMEOUT)
    expected_code = endpoint.get('expected_status_code', 200)
    
    try:
        response = requests.get(
            endpoint['endpoint_url'],
            timeout=timeout,
            allow_redirects=True
        )
        response_time_ms = int((time.time() - start_time) * 1000)
        
        # Determine status
        if response.status_code == expected_code:
            status = 'up'
        else:
            # Treat any unexpected status (4xx, 5xx) as DOWN to trigger outage analysis
            status = 'down'
        
        return {
            'endpoint_id': endpoint['id'],
            'tenant_id': endpoint['tenant_id'],
            'service_name': endpoint['service_name'],
            'status': status,
            'response_time_ms': response_time_ms,
            'status_code': response.status_code,
            'error_message': None
        }
        
    except requests.exceptions.Timeout:
        return {
            'endpoint_id': endpoint['id'],
            'tenant_id': endpoint['tenant_id'],
            'service_name': endpoint['service_name'],
            'status': 'down',
            'response_time_ms': int(timeout * 1000),
            'status_code': None,
            'error_message': 'Request timeout'
        }
    except requests.exceptions.ConnectionError as e:
        return {
            'endpoint_id': endpoint['id'],
            'tenant_id': endpoint['tenant_id'],
            'service_name': endpoint['service_name'],
            'status': 'down',
            'response_time_ms': int((time.time() - start_time) * 1000),
            'status_code': None,
            'error_message': f'Connection error: {str(e)[:200]}'
        }
    except Exception as e:
        return {
            'endpoint_id': endpoint['id'],
            'tenant_id': endpoint['tenant_id'],
            'service_name': endpoint['service_name'],
            'status': 'down',
            'response_time_ms': int((time.time() - start_time) * 1000),
            'status_code': None,
            'error_message': f'Error: {str(e)[:200]}'
        }


def save_health_check(conn, result):
    """Save a health check result to the database."""
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO health_checks 
                    (endpoint_id, tenant_id, service_name, status, 
                     response_time_ms, status_code, error_message)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (
                result['endpoint_id'],
                result['tenant_id'],
                result['service_name'],
                result['status'],
                result['response_time_ms'],
                result['status_code'],
                result['error_message']
            ))
            conn.commit()
    except Exception as e:
        logger.error(f"Failed to save health check: {e}")
        conn.rollback()


def check_for_outage(conn, result):
    """
    Check if we should create/update an outage record.
    Creates outage after OUTAGE_THRESHOLD consecutive failures.
    Resolves outage when service comes back up.
    """
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Check for ongoing outage
            cur.execute("""
                SELECT id, failure_count FROM outages 
                WHERE endpoint_id = %s AND status = 'ongoing'
                ORDER BY started_at DESC LIMIT 1
            """, (result['endpoint_id'],))
            ongoing_outage = cur.fetchone()
            
            if result['status'] == 'down':
                if ongoing_outage:
                    # Update existing outage
                    cur.execute("""
                        UPDATE outages 
                        SET failure_count = failure_count + 1
                        WHERE id = %s
                    """, (ongoing_outage['id'],))
                else:
                    # Check recent failures
                    cur.execute("""
                        SELECT COUNT(*) as fail_count FROM health_checks
                        WHERE endpoint_id = %s 
                          AND status = 'down'
                          AND checked_at > NOW() - INTERVAL '5 minutes'
                    """, (result['endpoint_id'],))
                    recent = cur.fetchone()
                    
                    if recent and recent['fail_count'] >= OUTAGE_THRESHOLD:
                        # TRIGGER AI INVESTIGATION
                        ai_insight = None
                        try:
                            # 1. Get recent error traces
                            traces = clickhouse_client.get_recent_error_traces(result['tenant_id'], minutes=5)
                            # 2. Analyze with AI
                            # 2. Analyze with AI (even if traces are empty, to explain why)
                            ai_insight = ai_agent.analyze_outage(
                                monitor_error=f"Status: {result['status']}, Code: {result['status_code']}, Error: {result['error_message']}", 
                                trace_data=traces
                            )
                        except Exception as e:
                            logger.error(f"AI Investigation failed: {e}")

                        # Create new outage with AI insight
                        cur.execute("""
                            INSERT INTO outages 
                                (endpoint_id, tenant_id, service_name, started_at, failure_count, ai_analysis)
                            VALUES (%s, %s, %s, NOW(), %s, %s)
                        """, (
                            result['endpoint_id'],
                            result['tenant_id'],
                            result['service_name'],
                            recent['fail_count'],
                            ai_insight
                        ))
                        logger.warning(f"OUTAGE DETECTED: {result['tenant_id']}/{result['service_name']} | AI Insight: {ai_insight}")
                
            elif result['status'] == 'up' and ongoing_outage:
                # Resolve outage
                cur.execute("""
                    UPDATE outages 
                    SET status = 'resolved',
                        ended_at = NOW(),
                        duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER
                    WHERE id = %s
                """, (ongoing_outage['id'],))
                logger.info(f"OUTAGE RESOLVED: {result['tenant_id']}/{result['service_name']}")
            
            conn.commit()
    except Exception as e:
        logger.error(f"Failed to check/update outage: {e}")
        conn.rollback()


def update_hourly_summary(conn, tenant_id):
    """Update hourly uptime summary for a tenant."""
    try:
        with conn.cursor() as cur:
            # Get current hour start
            cur.execute("""
                INSERT INTO uptime_summary 
                    (endpoint_id, tenant_id, service_name, period_start, period_type,
                     total_checks, successful_checks, uptime_percentage, 
                     avg_response_ms, min_response_ms, max_response_ms)
                SELECT 
                    hc.endpoint_id,
                    hc.tenant_id,
                    hc.service_name,
                    DATE_TRUNC('hour', NOW()) as period_start,
                    'hourly' as period_type,
                    COUNT(*) as total_checks,
                    SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) as successful_checks,
                    ROUND(SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END)::DECIMAL / NULLIF(COUNT(*), 0) * 100, 2),
                    AVG(response_time_ms)::INTEGER,
                    MIN(response_time_ms),
                    MAX(response_time_ms)
                FROM health_checks hc
                WHERE hc.tenant_id = %s
                  AND hc.checked_at >= DATE_TRUNC('hour', NOW())
                  AND hc.checked_at < DATE_TRUNC('hour', NOW()) + INTERVAL '1 hour'
                GROUP BY hc.endpoint_id, hc.tenant_id, hc.service_name
                ON CONFLICT (endpoint_id, period_start, period_type) 
                DO UPDATE SET
                    total_checks = EXCLUDED.total_checks,
                    successful_checks = EXCLUDED.successful_checks,
                    uptime_percentage = EXCLUDED.uptime_percentage,
                    avg_response_ms = EXCLUDED.avg_response_ms,
                    min_response_ms = EXCLUDED.min_response_ms,
                    max_response_ms = EXCLUDED.max_response_ms
            """, (tenant_id,))
            conn.commit()
    except Exception as e:
        logger.error(f"Failed to update hourly summary: {e}")
        conn.rollback()


def run_health_checks():
    """Main loop: fetch endpoints and check them."""
    conn = get_db_connection()
    if not conn:
        logger.error("Cannot start: database connection failed")
        return
    
    logger.info("Health Checker started")
    last_summary_update = {}
    
    while running:
        try:
            endpoints = get_active_endpoints(conn)
            
            if not endpoints:
                logger.debug("No active endpoints to check")
                time.sleep(10)
                continue
            
            logger.info(f"Checking {len(endpoints)} endpoints...")
            
            # Run checks in parallel
            with ThreadPoolExecutor(max_workers=CHECK_BATCH_SIZE) as executor:
                futures = {executor.submit(check_endpoint, ep): ep for ep in endpoints}
                
                for future in as_completed(futures):
                    result = future.result()
                    
                    # Save result
                    save_health_check(conn, result)
                    
                    # Check for outage
                    check_for_outage(conn, result)
                    
                    # Log status
                    status_icon = "✅" if result['status'] == 'up' else "⚠️" if result['status'] == 'degraded' else "❌"
                    logger.info(f"{status_icon} {result['tenant_id']}/{result['service_name']}: {result['status']} ({result['response_time_ms']}ms)")
                    
                    # Update hourly summary every 5 minutes per tenant
                    tenant = result['tenant_id']
                    if tenant not in last_summary_update or \
                       (datetime.now() - last_summary_update[tenant]).seconds > 300:
                        update_hourly_summary(conn, tenant)
                        last_summary_update[tenant] = datetime.now()
            
            # Wait before next batch
            time.sleep(30)
            
        except Exception as e:
            logger.error(f"Error in health check loop: {e}")
            time.sleep(10)
            # Reconnect if needed
            if conn.closed:
                conn = get_db_connection()
    
    if conn and not conn.closed:
        conn.close()
    logger.info("Health Checker stopped")


if __name__ == "__main__":
    print("=" * 60)
    print("🏥 ObseraCloud Health Checker")
    print("=" * 60)
    print(f"📊 Database: {DATABASE_URL.split('@')[-1] if '@' in DATABASE_URL else 'configured'}")
    print(f"⏱️  Check interval: 30 seconds")
    print(f"🚨 Outage threshold: {OUTAGE_THRESHOLD} consecutive failures")
    print("⏹️  Press Ctrl+C to stop\n")
    
    run_health_checks()

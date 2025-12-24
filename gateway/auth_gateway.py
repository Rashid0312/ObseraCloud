"""
ObseraCloud Auth Gateway - OTLP Authentication Proxy
Validates API keys and injects tenant_id into telemetry data
"""

from flask import Flask, request, Response
from flask_cors import CORS
import requests
import json
import logging
import os
import psycopg2
from psycopg2.extras import RealDictCursor

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Configuration
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://obsera_user:obsera_password@postgres:5432/obsera")
OTEL_COLLECTOR_URL = os.getenv("OTEL_COLLECTOR_URL", "http://otel-collector:4318")

# Cache for API keys (simple in-memory, production should use Redis)
api_key_cache = {}

def get_db_connection():
    """Create database connection"""
    try:
        conn = psycopg2.connect(DATABASE_URL)
        return conn
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        return None

def validate_api_key(api_key: str) -> dict:
    """Validate API key and return tenant info"""
    if not api_key:
        return None
    
    # Check cache first
    if api_key in api_key_cache:
        return api_key_cache[api_key]
    
    # Query database
    conn = get_db_connection()
    if not conn:
        return None
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT tenant_id, company_name, is_active
                FROM tenants
                WHERE api_key = %s
            """, (api_key,))
            result = cur.fetchone()
            
            if result and result['is_active']:
                tenant_info = {
                    'tenant_id': result['tenant_id'],
                    'company_name': result['company_name']
                }
                # Cache for 5 minutes
                api_key_cache[api_key] = tenant_info
                return tenant_info
            return None
    except Exception as e:
        logger.error(f"API key validation failed: {e}")
        return None
    finally:
        conn.close()

def inject_tenant_attribute(data: dict, tenant_id: str) -> dict:
    """Inject tenant_id into all resource spans"""
    if 'resourceSpans' in data:
        for resource_span in data['resourceSpans']:
            if 'resource' not in resource_span:
                resource_span['resource'] = {'attributes': []}
            if 'attributes' not in resource_span['resource']:
                resource_span['resource']['attributes'] = []
            
            # Add tenant_id attribute
            resource_span['resource']['attributes'].append({
                'key': 'tenant_id',
                'value': {'stringValue': tenant_id}
            })
    return data

def inject_tenant_to_logs(data: dict, tenant_id: str) -> dict:
    """Inject tenant_id into log records"""
    if 'resourceLogs' in data:
        for resource_log in data['resourceLogs']:
            if 'resource' not in resource_log:
                resource_log['resource'] = {'attributes': []}
            if 'attributes' not in resource_log['resource']:
                resource_log['resource']['attributes'] = []
            
            resource_log['resource']['attributes'].append({
                'key': 'tenant_id',
                'value': {'stringValue': tenant_id}
            })
    return data

def inject_tenant_to_metrics(data: dict, tenant_id: str) -> dict:
    """Inject tenant_id into metrics"""
    if 'resourceMetrics' in data:
        for resource_metric in data['resourceMetrics']:
            if 'resource' not in resource_metric:
                resource_metric['resource'] = {'attributes': []}
            if 'attributes' not in resource_metric['resource']:
                resource_metric['resource']['attributes'] = []
            
            resource_metric['resource']['attributes'].append({
                'key': 'tenant_id',
                'value': {'stringValue': tenant_id}
            })
    return data

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return {'status': 'healthy', 'service': 'auth-gateway'}, 200

@app.route('/v1/traces', methods=['POST'])
def traces_proxy():
    """Proxy traces with authentication"""
    api_key = request.headers.get('X-API-Key')
    
    if not api_key:
        logger.warning(f"Missing API key from {request.remote_addr}")
        return {'error': 'Missing X-API-Key header'}, 401
    
    tenant_info = validate_api_key(api_key)
    if not tenant_info:
        logger.warning(f"Invalid API key attempt from {request.remote_addr}")
        return {'error': 'Invalid API key'}, 401
    
    try:
        # Parse and inject tenant_id
        data = request.get_json()
        data = inject_tenant_attribute(data, tenant_info['tenant_id'])
        
        # Forward to OTEL Collector
        response = requests.post(
            f"{OTEL_COLLECTOR_URL}/v1/traces",
            json=data,
            headers={'Content-Type': 'application/json'},
            timeout=10
        )
        
        logger.info(f"Trace forwarded for tenant: {tenant_info['tenant_id']}")
        return Response(
            response.content,
            status=response.status_code,
            content_type='application/json'
        )
    except Exception as e:
        logger.error(f"Failed to forward trace: {e}")
        return {'error': 'Failed to process trace'}, 500

@app.route('/v1/logs', methods=['POST'])
def logs_proxy():
    """Proxy logs with authentication"""
    api_key = request.headers.get('X-API-Key')
    
    if not api_key:
        return {'error': 'Missing X-API-Key header'}, 401
    
    tenant_info = validate_api_key(api_key)
    if not tenant_info:
        return {'error': 'Invalid API key'}, 401
    
    try:
        data = request.get_json()
        data = inject_tenant_to_logs(data, tenant_info['tenant_id'])
        
        response = requests.post(
            f"{OTEL_COLLECTOR_URL}/v1/logs",
            json=data,
            headers={'Content-Type': 'application/json'},
            timeout=10
        )
        
        logger.info(f"Logs forwarded for tenant: {tenant_info['tenant_id']}")
        return Response(
            response.content,
            status=response.status_code,
            content_type='application/json'
        )
    except Exception as e:
        logger.error(f"Failed to forward logs: {e}")
        return {'error': 'Failed to process logs'}, 500

@app.route('/v1/metrics', methods=['POST'])
def metrics_proxy():
    """Proxy metrics with authentication"""
    api_key = request.headers.get('X-API-Key')
    
    if not api_key:
        return {'error': 'Missing X-API-Key header'}, 401
    
    tenant_info = validate_api_key(api_key)
    if not tenant_info:
        return {'error': 'Invalid API key'}, 401
    
    try:
        data = request.get_json()
        data = inject_tenant_to_metrics(data, tenant_info['tenant_id'])
        
        response = requests.post(
            f"{OTEL_COLLECTOR_URL}/v1/metrics",
            json=data,
            headers={'Content-Type': 'application/json'},
            timeout=10
        )
        
        logger.info(f"Metrics forwarded for tenant: {tenant_info['tenant_id']}")
        return Response(
            response.content,
            status=response.status_code,
            content_type='application/json'
        )
    except Exception as e:
        logger.error(f"Failed to forward metrics: {e}")
        return {'error': 'Failed to process metrics'}, 500

if __name__ == '__main__':
    logger.info("Starting ObseraCloud Auth Gateway on port 4319")
    app.run(host='0.0.0.0', port=4319, debug=False)

# backend/app.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import os
from datetime import datetime, timedelta
import logging
import psycopg2
from psycopg2.extras import RealDictCursor
import bcrypt
import secrets
from contextlib import nullcontext

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:5173", "http://localhost:3000"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

# Environment Configuration
LOKI_URL = os.getenv("LOKI_URL", "http://localhost:3100")
PROMETHEUS_URL = os.getenv("PROMETHEUS_URL", "http://localhost:9090")
TEMPO_URL = os.getenv("TEMPO_URL", "http://localhost:3200")
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/observability")

# ==================== DATABASE CONNECTION ====================

def get_db_connection():
    """Create database connection"""
    try:
        conn = psycopg2.connect(DATABASE_URL)
        return conn
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        return None

def start_span(name):
    """Safely start a trace span"""
    return nullcontext()

# ==================== TENANT REGISTRATION ====================

@app.route('/api/auth/register', methods=['POST'])
def register():
    """Register a new tenant"""
    try:
        data = request.get_json()
        tenant_id = data.get('tenant_id')
        company_name = data.get('company_name')
        email = data.get('email')
        password = data.get('password')
        
        # Validation
        if not all([tenant_id, company_name, email, password]):
            return jsonify({"error": "All fields are required"}), 400
        
        if len(password) < 8:
            return jsonify({"error": "Password must be at least 8 characters"}), 400
        
        # Hash password
        password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        # Generate API key
        api_key = secrets.token_urlsafe(32)
        
        # Insert into database
        conn = get_db_connection()
        if not conn:
            return jsonify({"error": "Database connection failed"}), 500
        
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO tenants (tenant_id, company_name, email, password_hash, api_key)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id, tenant_id, company_name, api_key
                """, (tenant_id, company_name, email, password_hash, api_key))
                
                result = cur.fetchone()
                conn.commit()
                
                logger.info(f"New tenant registered: {tenant_id}")
                return jsonify({
                    "message": "Tenant registered successfully",
                    "tenant_id": result[1],
                    "company_name": result[2],
                    "api_key": result[3]
                }), 201
                
        except psycopg2.IntegrityError as e:
            conn.rollback()
            if 'tenant_id' in str(e):
                return jsonify({"error": "Tenant ID already exists"}), 409
            elif 'email' in str(e):
                return jsonify({"error": "Email already registered"}), 409
            return jsonify({"error": "Registration failed"}), 500
        finally:
            conn.close()
            
    except Exception as e:
        logger.error(f"Registration error: {str(e)}")
        return jsonify({"error": "Registration failed"}), 500

# ==================== TENANT LOGIN ====================

@app.route('/api/auth/login', methods=['POST'])
def login():
    """Authenticate tenant"""
    try:
        data = request.get_json()
        tenant_id = data.get('tenant_id')
        password = data.get('password')
        
        if not tenant_id or not password:
            return jsonify({"error": "tenant_id and password required"}), 400
        
        # Query database
        conn = get_db_connection()
        if not conn:
            return jsonify({"error": "Database connection failed"}), 500
        
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT tenant_id, company_name, password_hash, api_key, is_active
                    FROM tenants
                    WHERE tenant_id = %s
                """, (tenant_id,))
                
                tenant = cur.fetchone()
                
                if not tenant:
                    logger.warning(f"Failed login - tenant not found: {tenant_id}")
                    return jsonify({"error": "Invalid credentials"}), 401
                
                if not tenant['is_active']:
                    logger.warning(f"Failed login - inactive tenant: {tenant_id}")
                    return jsonify({"error": "Account is inactive"}), 403
                
                # Verify password
                if not bcrypt.checkpw(password.encode('utf-8'), tenant['password_hash'].encode('utf-8')):
                    logger.warning(f"Failed login - wrong password: {tenant_id}")
                    return jsonify({"error": "Invalid credentials"}), 401
                
                logger.info(f"Successful login for tenant: {tenant_id}")
                return jsonify({
                    "tenant_id": tenant['tenant_id'],
                    "name": tenant['company_name'],
                    "api_key": tenant['api_key'],
                    "message": "Login successful"
                }), 200
                
        finally:
            conn.close()
            
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        return jsonify({"error": "Login failed"}), 500

# ==================== VALIDATE TENANT ====================

def validate_tenant(tenant_id):
    """Check if tenant exists and is active"""
    conn = get_db_connection()
    if not conn:
        return False
    
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT is_active FROM tenants WHERE tenant_id = %s", (tenant_id,))
            result = cur.fetchone()
            return result and result[0]
    finally:
        conn.close()

# ==================== LOGS (LOKI) ====================

@app.route('/api/logs', methods=['GET'])
def get_logs():
    """Query logs from Loki for a specific tenant"""
    tenant_id = request.args.get('tenant_id')
    limit = request.args.get('limit', '100')
    level = request.args.get('level', '')
    hours = int(request.args.get('hours', '1'))
    
    if not tenant_id:
        return jsonify({"error": "tenant_id query parameter required"}), 400
    
    if not validate_tenant(tenant_id):
        return jsonify({"error": "Invalid or inactive tenant"}), 403
    
    if level:
        logql_query = f'{{job="demo-app", level="{level}"}}'
    else:
        logql_query = '{job="demo-app"}'
    
    end_time = datetime.now()
    start_time = end_time - timedelta(hours=hours)
    
    try:
        response = requests.get(
            f"{LOKI_URL}/loki/api/v1/query_range",
            params={
                "query": logql_query,
                "limit": limit,
                "start": int(start_time.timestamp() * 1e9),
                "end": int(end_time.timestamp() * 1e9)
            },
            timeout=10
        )
        response.raise_for_status()
        
        data = response.json()
        logs = []
        
        for stream in data.get('data', {}).get('result', []):
            stream_labels = stream.get('stream', {})
            for value in stream.get('values', []):
                timestamp_ns = int(value[0])
                timestamp_readable = datetime.fromtimestamp(timestamp_ns / 1e9).isoformat()
                
                logs.append({
                    "timestamp": timestamp_readable,
                    "timestamp_ns": timestamp_ns,
                    "message": value[1],
                    "level": stream_labels.get('level', 'INFO'),
                    "service": stream_labels.get('service_name', 'unknown'),
                    "labels": stream_labels
                })
        
        logs.sort(key=lambda x: x['timestamp_ns'], reverse=True)
        
        logger.info(f"Retrieved {len(logs)} logs for tenant: {tenant_id}")
        return jsonify({
            "tenant_id": tenant_id,
            "logs": logs,
            "count": len(logs),
            "query": logql_query
        }), 200
        
    except requests.exceptions.ConnectionError:
        logger.error(f"Cannot connect to Loki at {LOKI_URL}")
        return jsonify({"error": "Loki service unavailable"}), 503
    except requests.RequestException as e:
        logger.error(f"Loki query failed for {tenant_id}: {str(e)}")
        return jsonify({"error": f"Failed to query Loki: {str(e)}"}), 500

# ==================== METRICS (PROMETHEUS) ====================

@app.route('/api/metrics', methods=['GET'])
def get_metrics():
    """Query instant metrics from Prometheus"""
    tenant_id = request.args.get('tenant_id')
    metric = request.args.get('metric', 'http_requests_total')
    
    if not tenant_id:
        return jsonify({"error": "tenant_id query parameter required"}), 400
    
    if not validate_tenant(tenant_id):
        return jsonify({"error": "Invalid or inactive tenant"}), 403
    
    promql_query = f'{metric}{{job="demo-app"}}'
    
    try:
        response = requests.get(
            f"{PROMETHEUS_URL}/api/v1/query",
            params={"query": promql_query},
            timeout=10
        )
        response.raise_for_status()
        
        data = response.json()
        metrics = data.get('data', {}).get('result', [])
        
        logger.info(f"Retrieved {len(metrics)} metrics for tenant: {tenant_id}")
        return jsonify({
            "tenant_id": tenant_id,
            "metrics": metrics,
            "count": len(metrics),
            "query": promql_query
        }), 200
        
    except requests.exceptions.ConnectionError:
        logger.error(f"Cannot connect to Prometheus at {PROMETHEUS_URL}")
        return jsonify({"error": "Prometheus service unavailable"}), 503
    except requests.RequestException as e:
        logger.error(f"Prometheus query failed: {str(e)}")
        return jsonify({"error": f"Failed to query Prometheus: {str(e)}"}), 500

@app.route('/api/metrics/range', methods=['GET'])
def get_metrics_range():
    """Query time-series metrics from Prometheus"""
    tenant_id = request.args.get('tenant_id')
    metric = request.args.get('metric', 'http_requests_total')
    hours = int(request.args.get('hours', '1'))
    
    if not tenant_id:
        return jsonify({"error": "tenant_id query parameter required"}), 400
    
    if not validate_tenant(tenant_id):
        return jsonify({"error": "Invalid or inactive tenant"}), 403
    
    promql_query = f'{metric}{{job="demo-app"}}'
    end_time = datetime.now()
    start_time = end_time - timedelta(hours=hours)
    
    try:
        response = requests.get(
            f"{PROMETHEUS_URL}/api/v1/query_range",
            params={
                "query": promql_query,
                "start": start_time.timestamp(),
                "end": end_time.timestamp(),
                "step": "30s"
            },
            timeout=10
        )
        response.raise_for_status()
        
        data = response.json()
        result = data.get('data', {})
        
        return jsonify({
            "tenant_id": tenant_id,
            "data": result,
            "query": promql_query
        }), 200
        
    except requests.exceptions.ConnectionError:
        logger.error(f"Cannot connect to Prometheus at {PROMETHEUS_URL}")
        return jsonify({"error": "Prometheus service unavailable"}), 503
    except requests.RequestException as e:
        logger.error(f"Prometheus range query failed: {str(e)}")
        return jsonify({"error": f"Failed to query Prometheus: {str(e)}"}), 500

# ==================== TRACES (TEMPO) ====================

@app.route('/api/traces', methods=['GET'])
def get_traces():
    """Query traces from Tempo"""
    tenant_id = request.args.get('tenant_id')
    limit = request.args.get('limit', '20')
    
    if not tenant_id:
        return jsonify({"error": "tenant_id query parameter required"}), 400
    
    if not validate_tenant(tenant_id):
        return jsonify({"error": "Invalid or inactive tenant"}), 403
    
    try:
        response = requests.get(
            f"{TEMPO_URL}/api/search",
            params={
                "tags": "service.name=demo-app",
                "limit": limit
            },
            timeout=10
        )
        response.raise_for_status()
        
        data = response.json()
        traces = data.get('traces', [])
        
        logger.info(f"Retrieved {len(traces)} traces for tenant: {tenant_id}")
        return jsonify({
            "tenant_id": tenant_id,
            "traces": traces,
            "count": len(traces)
        }), 200
        
    except requests.exceptions.ConnectionError:
        logger.error(f"Cannot connect to Tempo at {TEMPO_URL}")
        return jsonify({"error": "Tempo service unavailable"}), 503
    except requests.RequestException as e:
        logger.error(f"Tempo query failed: {str(e)}")
        return jsonify({"error": f"Failed to query Tempo: {str(e)}"}), 500

@app.route('/api/traces/search', methods=['GET'])
def search_traces():
    """Search traces by trace_id or service"""
    tenant_id = request.args.get('tenant_id')
    trace_id = request.args.get('trace_id')
    service = request.args.get('service', 'demo-app')
    limit = request.args.get('limit', '20')
    
    if not tenant_id:
        return jsonify({"error": "tenant_id required"}), 400
    
    if not validate_tenant(tenant_id):
        return jsonify({"error": "Invalid or inactive tenant"}), 403
    
    search_params = {"limit": limit}
    
    if trace_id:
        try:
            response = requests.get(
                f"{TEMPO_URL}/api/traces/{trace_id}",
                timeout=10
            )
            response.raise_for_status()
            return jsonify(response.json()), 200
        except requests.RequestException as e:
            return jsonify({"error": f"Trace not found: {str(e)}"}), 404
    else:
        search_params["tags"] = f"service.name={service}"
    
    try:
        response = requests.get(
            f"{TEMPO_URL}/api/search",
            params=search_params,
            timeout=10
        )
        response.raise_for_status()
        
        return jsonify(response.json()), 200
        
    except requests.exceptions.ConnectionError:
        logger.error(f"Cannot connect to Tempo at {TEMPO_URL}")
        return jsonify({"error": "Tempo service unavailable"}), 503
    except requests.RequestException as e:
        logger.error(f"Tempo search failed: {str(e)}")
        return jsonify({"error": f"Tempo search failed: {str(e)}"}), 500

# ==================== HEALTH CHECK ====================

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint with service status"""
    services_status = {}
    
    # Check Database
    try:
        conn = get_db_connection()
        if conn:
            conn.close()
            services_status['database'] = {'status': 'healthy'}
        else:
            services_status['database'] = {'status': 'unavailable'}
    except:
        services_status['database'] = {'status': 'unavailable'}
    
    # Check Loki
    try:
        requests.get(f"{LOKI_URL}/ready", timeout=2)
        services_status['loki'] = {'url': LOKI_URL, 'status': 'healthy'}
    except:
        services_status['loki'] = {'url': LOKI_URL, 'status': 'unavailable'}
    
    # Check Prometheus
    try:
        requests.get(f"{PROMETHEUS_URL}/-/healthy", timeout=2)
        services_status['prometheus'] = {'url': PROMETHEUS_URL, 'status': 'healthy'}
    except:
        services_status['prometheus'] = {'url': PROMETHEUS_URL, 'status': 'unavailable'}
    
    # Check Tempo
    try:
        requests.get(f"{TEMPO_URL}/ready", timeout=2)
        services_status['tempo'] = {'url': TEMPO_URL, 'status': 'healthy'}
    except:
        services_status['tempo'] = {'url': TEMPO_URL, 'status': 'unavailable'}
    
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "services": services_status
    }), 200

@app.route('/', methods=['GET'])
def root():
    """Root endpoint with API documentation"""
    return jsonify({
        "service": "Multi-Tenant Observability Platform API",
        "version": "2.0.0",
        "endpoints": {
            "authentication": {
                "register": "POST /api/auth/register",
                "login": "POST /api/auth/login"
            },
            "logs": {
                "query": "GET /api/logs?tenant_id=<id>&limit=<n>&level=<INFO|WARN|ERROR>&hours=<n>"
            },
            "metrics": {
                "instant": "GET /api/metrics?tenant_id=<id>&metric=<name>",
                "range": "GET /api/metrics/range?tenant_id=<id>&metric=<name>&hours=<n>"
            },
            "traces": {
                "query": "GET /api/traces?tenant_id=<id>&limit=<n>",
                "search": "GET /api/traces/search?tenant_id=<id>&trace_id=<id>&service=<name>"
            },
            "health": "GET /health"
        }
    }), 200

# ==================== ERROR HANDLERS ====================

@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Endpoint not found"}), 404

@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal server error: {str(error)}")
    return jsonify({"error": "Internal server error"}), 500

# ==================== MAIN ====================

if __name__ == '__main__':
    logger.info("=" * 60)
    logger.info("Multi-Tenant Observability Platform API Starting")
    logger.info("=" * 60)
    logger.info(f"Loki:       {LOKI_URL}")
    logger.info(f"Prometheus: {PROMETHEUS_URL}")
    logger.info(f"Tempo:      {TEMPO_URL}")
    logger.info(f"Database:   {DATABASE_URL}")
    logger.info("=" * 60)
    
    app.run(host='0.0.0.0', port=5001, debug=True)

# backend/app.py
from flask import Flask, request, jsonify, g
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import requests
import os
import re
import jwt
from datetime import datetime, timedelta, timezone
import time
import logging
import psycopg2
from psycopg2.extras import RealDictCursor
import bcrypt
import clickhouse_client as ch # ClickHouse Client
import secrets
from functools import wraps
from contextlib import nullcontext
import ai_agent # Trace Doctor

# Trace cache for consistent results (Tempo returns non-deterministic results)
_trace_cache = {}  # {tenant_id: {"traces": [...], "timestamp": time.time()}}

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
        "origins": "*",  # Allow all origins for production
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "X-API-Key"]
    }
})

# Rate Limiter Configuration
limiter = Limiter(
    key_func=get_remote_address,
    app=app,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://"
)

# JWT Configuration
# JWT Configuration - Uses JWT_SECRET_KEY from environment
JWT_SECRET = os.getenv("JWT_SECRET_KEY", secrets.token_hex(32))
JWT_EXPIRY_HOURS = 24

# Environment Configuration
LOKI_URL = os.getenv("LOKI_URL", "http://localhost:3100")
PROMETHEUS_URL = os.getenv("PROMETHEUS_URL", "http://localhost:9090")
TEMPO_URL = os.getenv("TEMPO_URL", "http://localhost:3200")
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/observability")

# ==================== SECURITY MIDDLEWARE ====================

@app.after_request
def add_security_headers(response):
    """Add security headers to all responses"""
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate'
    return response

def validate_api_key(api_key):
    """Validate API key against database"""
    if not api_key:
        return None
    conn = get_db_connection()
    if not conn:
        return None
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT tenant_id FROM tenants WHERE api_key = %s AND is_active = TRUE", (api_key,))
            result = cur.fetchone()
            return result['tenant_id'] if result else None
    except Exception as e:
        logger.error(f"API key validation failed: {e}")
        return None
    finally:
        conn.close()

def require_api_key(f):
    """Decorator to require valid API key for endpoints"""
    @wraps(f)
    def decorated(*args, **kwargs):
        api_key = request.headers.get('X-API-Key')
        tenant_id = validate_api_key(api_key)
        if not tenant_id:
            logger.warning(f"Invalid API key attempt from {request.remote_addr}")
            return jsonify({"error": "Invalid or missing API key"}), 401
        g.tenant_id = tenant_id
        return f(*args, **kwargs)
    return decorated

def generate_jwt_token(tenant_id, tenant_name):
    """Generate JWT token for authenticated session"""
    payload = {
        'tenant_id': tenant_id,
        'tenant_name': tenant_name,
        'exp': datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS),
        'iat': datetime.now(timezone.utc)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')

def verify_jwt_token(token):
    """Verify and decode JWT token"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def require_jwt(f):
    """Decorator to require valid JWT token"""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({"error": "Missing authorization token"}), 401
        
        token = auth_header.split(' ')[1]
        payload = verify_jwt_token(token)
        if not payload:
            return jsonify({"error": "Invalid or expired token"}), 401
        
        g.tenant_id = payload['tenant_id']
        g.tenant_name = payload['tenant_name']
        return f(*args, **kwargs)
    return decorated

def sanitize_input(value, max_length=100, pattern=r'^[a-zA-Z0-9_-]+$'):
    """Sanitize and validate input"""
    if not value or len(value) > max_length:
        return None
    if not re.match(pattern, value):
        return None
    return value

def verify_tenant_access(requested_tenant_id):
    """
    SECURITY: Verify the authenticated user has access to the requested tenant_id.
    Returns tuple (is_valid, error_response)
    """
    # Check if we have an authenticated tenant from JWT
    authenticated_tenant = getattr(g, 'tenant_id', None)
    
    if not authenticated_tenant:
        # No JWT auth - fallback to just validating tenant exists (legacy behavior)
        # This allows unauthenticated dashboard access for demo purposes
        return validate_tenant(requested_tenant_id), None
    
    # CRITICAL: Verify the requested tenant matches the authenticated user
    if requested_tenant_id != authenticated_tenant:
        logger.warning(f"SECURITY: Tenant {authenticated_tenant} attempted to access {requested_tenant_id}")
        return False, (jsonify({"error": "Access denied: You can only access your own tenant data"}), 403)
    
    # Validate the tenant is active
    if not validate_tenant(requested_tenant_id):
        return False, (jsonify({"error": "Invalid or inactive tenant"}), 403)
    
    return True, None

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
@limiter.limit("5 per minute")  # Rate limit: 5 login attempts per minute
def login():
    """Authenticate tenant"""
    try:
        data = request.get_json()
        tenant_id = data.get('tenant_id')
        password = data.get('password')
        
        # Input validation
        if not tenant_id or not password:
            return jsonify({"error": "tenant_id and password required"}), 400
        
        # Sanitize tenant_id
        if not sanitize_input(tenant_id, max_length=50):
            return jsonify({"error": "Invalid tenant_id format"}), 400
        
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
                
                # Generate JWT token
                token = generate_jwt_token(tenant['tenant_id'], tenant['company_name'])
                
                # Update last_login timestamp
                cur.execute("UPDATE tenants SET last_login = NOW() WHERE tenant_id = %s", (tenant_id,))
                conn.commit()
                
                logger.info(f"Successful login for tenant: {tenant_id}")
                return jsonify({
                    "tenant_id": tenant['tenant_id'],
                    "name": tenant['company_name'],
                    "api_key": tenant['api_key'],
                    "token": token,
                    "expires_in": JWT_EXPIRY_HOURS * 3600,
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

def map_otel_severity_to_level(severity_number: int) -> str:
    """
    Map OpenTelemetry SeverityNumber to log level text.
    Reference: https://opentelemetry.io/docs/specs/otel/logs/data-model/#field-severitynumber
    
    Severity ranges:
    1-4:   TRACE
    5-8:   DEBUG  
    9-12:  INFO
    13-16: WARN
    17-20: ERROR
    21-24: FATAL
    """
    if severity_number is None:
        return 'INFO'
    if severity_number <= 4:
        return 'TRACE'
    elif severity_number <= 8:
        return 'DEBUG'
    elif severity_number <= 12:
        return 'INFO'
    elif severity_number <= 16:
        return 'WARN'
    elif severity_number <= 20:
        return 'ERROR'
    else:
        return 'FATAL'

def extract_severity_from_log(log_message: str, stream_labels: dict) -> str:
    """
    Extract severity level from log message or labels.
    Tries multiple sources: stream labels, JSON body, keywords in message.
    """
    # First try stream labels
    if 'level' in stream_labels:
        return stream_labels['level'].upper()
    if 'severity_text' in stream_labels:
        return stream_labels['severity_text'].upper()
    
    # Try parsing JSON log body for severity_number or severity_text
    try:
        import json
        log_data = json.loads(log_message)
        
        # Check for severity_text first
        if 'severity_text' in log_data:
            return log_data['severity_text'].upper()
        if 'severityText' in log_data:
            return log_data['severityText'].upper()
        if 'level' in log_data:
            return log_data['level'].upper()
            
        # Check for severity_number
        severity_num = log_data.get('severity_number') or log_data.get('severityNumber') or log_data.get('SeverityNumber')
        if severity_num is not None:
            return map_otel_severity_to_level(int(severity_num))
    except (json.JSONDecodeError, ValueError, TypeError):
        pass
    
    # Fallback: Check message content for error indicators
    upper_msg = log_message.upper()
    if 'ERROR' in upper_msg or 'EXCEPTION' in upper_msg or 'FAILED' in upper_msg:
        return 'ERROR'
    elif 'WARN' in upper_msg:
        return 'WARN'
    elif 'DEBUG' in upper_msg:
        return 'DEBUG'
    
    return 'INFO'

# ==================== LOGS (LOKI) ====================

@app.route('/api/logs', methods=['GET'])
@limiter.limit("100 per minute")  # Rate limit: 100 requests per minute
@require_jwt
def get_logs():
    """Query logs from ClickHouse for a specific tenant"""
    tenant_id = request.args.get('tenant_id')
    limit = int(request.args.get('limit', '100'))
    level = request.args.get('level', '')
    
    # Input validation
    if not sanitize_input(tenant_id, max_length=50):
        return jsonify({"error": "Invalid tenant_id format"}), 400
    hours = float(request.args.get('hours', '1'))
    
    if not tenant_id:
        return jsonify({"error": "tenant_id query parameter required"}), 400
    
    # SECURITY: Verify authenticated user can access this tenant
    is_valid, error_response = verify_tenant_access(tenant_id)
    if not is_valid:
        return error_response

    end_time = datetime.now()
    start_time = end_time - timedelta(hours=hours)
    
    try:
        # Use ClickHouse Client
        db_logs = ch.get_logs(
            tenant_id=tenant_id,
            severity=level,
            start_time=start_time,
            end_time=end_time,
            limit=limit
        )
        
        # Transform for Frontend (keep consistent format)
        logs = []
        for row in db_logs:
            # ClickHouse returns datetime objects
            timestamp_dt = row['Timestamp']
            # Convert to ISO string usually expected by frontend
            # The previous implementation expected UTC+1 adjustment, let's keep it if needed or trust the brower
            # The previous code did: local_dt = utc_dt + timedelta(hours=1)
            # We will use the timestamp as is from DB (which is stored as DateTime64)
            
            logs.append({
                "timestamp": timestamp_dt.isoformat(),
                "timestamp_ns": int(timestamp_dt.timestamp() * 1e9),
                "message": row['Body'],
                "level": row['SeverityText'],
                "service": row['ServiceName'],
                "labels": row['LogAttributes'] or {},
                "trace_id": row['TraceId']
            })
            
        logger.info(f"Retrieved {len(logs)} logs from ClickHouse for tenant: {tenant_id}")
        return jsonify({
            "tenant_id": tenant_id,
            "logs": logs,
            "count": len(logs),
            "source": "clickhouse"
        }), 200
        
    except Exception as e:
        logger.error(f"ClickHouse query failed for {tenant_id}: {str(e)}")
        return jsonify({"error": f"Failed to query logs: {str(e)}"}), 500

# ==================== METRICS (PROMETHEUS) ====================

@app.route('/api/metrics', methods=['GET'])
@limiter.limit("100 per minute")
@require_jwt
def get_metrics():
    """Query metrics from ClickHouse"""
    tenant_id = request.args.get('tenant_id')
    metric_name = request.args.get('metric', '')
    hours = float(request.args.get('hours', '1'))
    
    if not tenant_id:
        return jsonify({"error": "tenant_id query parameter required"}), 400
    
    # SECURITY: Verify authenticated user can access this tenant
    is_valid, error_response = verify_tenant_access(tenant_id)
    if not is_valid:
        return error_response

    # Default to http_requests_total if not specified
    if not metric_name:
        metric_name = 'http_requests_total'

    end_time = datetime.now()
    start_time = end_time - timedelta(hours=hours)
    
    try:
        # Use ClickHouse Client (Points are pre-aggregated by OTel Collector usually or raw)
        # We query the raw points for now
        points = ch.get_metrics_sum(
            tenant_id=tenant_id,
            metric_name=metric_name,
            start_time=start_time,
            end_time=end_time
        )
        
        metrics = []
        for point in points:
            # Convert to UTC+1 (CET) for display as per original logic
            ts = point['TimestampUnix']
            utc_dt = datetime.fromtimestamp(ts, tz=timezone.utc)
            local_dt = utc_dt + timedelta(hours=1)
            
            metrics.append({
                "timestamp": local_dt.strftime('%Y-%m-%dT%H:%M:%S'),
                "metric_name": metric_name,
                "value": point['Value'],
                "labels": point['Attributes'] or {}
            })
            
        # Sort by timestamp descending
        metrics.sort(key=lambda x: x['timestamp'], reverse=True)
        
        logger.info(f"Retrieved {len(metrics)} metrics from ClickHouse for tenant: {tenant_id}")
        return jsonify({
            "tenant_id": tenant_id,
            "metrics": metrics,
            "count": len(metrics),
            "source": "clickhouse"
        }), 200
        
    except Exception as e:
        logger.error(f"ClickHouse metric query failed: {str(e)}")
        return jsonify({"error": f"Failed to query metrics: {str(e)}"}), 500

@app.route('/api/metrics/range', methods=['GET'])
def get_metrics_range():
    """Query time-series metrics from Prometheus"""
    tenant_id = request.args.get('tenant_id')
    metric = request.args.get('metric', 'http_requests_total')
    hours = float(request.args.get('hours', '1'))
    
    if not tenant_id:
        return jsonify({"error": "tenant_id query parameter required"}), 400
    
    if not validate_tenant(tenant_id):
        return jsonify({"error": "Invalid or inactive tenant"}), 403
    
    promql_query = f'{metric}{{tenant_id="{tenant_id}"}}'
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
@limiter.limit("100 per minute")
@require_jwt
def get_traces():
    """Query traces from ClickHouse"""
    tenant_id = request.args.get('tenant_id')
    limit = int(request.args.get('limit', '20'))
    hours = float(request.args.get('hours', '24'))
    
    if not tenant_id:
        return jsonify({"error": "tenant_id query parameter required"}), 400
    
    # SECURITY: Verify authenticated user can access this tenant
    is_valid, error_response = verify_tenant_access(tenant_id)
    if not is_valid:
        return error_response

    end_time = datetime.now()
    start_time = end_time - timedelta(hours=hours)

    try:
        # CLICKHOUSE: No cache needed! deterministic results.
        traces = ch.get_traces(
            tenant_id=tenant_id,
            start_time=start_time,
            end_time=end_time,
            limit=limit
        )
        
        # Mapping to frontend format
        result_traces = []
        for t in traces:
            result_traces.append({
                "traceID": t['TraceId'],
                "rootTraceName": t['RootTraceName'],
                "rootServiceName": t['RootServiceName'] or 'unknown',
                "startTimeUnixNano": str(t['StartTimeUnixNano']),
                "durationMs": t['DurationNano'] / 1_000_000,
                "status": t['StatusCode'],
                "spanAttributes": t.get('SpanAttributes') or {},
                "resourceAttributes": t.get('ResourceAttributes') or {}
            })
            
        logger.info(f"Retrieved {len(result_traces)} traces from ClickHouse for tenant: {tenant_id}")
        return jsonify({
            "tenant_id": tenant_id,
            "traces": result_traces,
            "count": len(result_traces),
            "source": "clickhouse"
        }), 200
        
    except Exception as e:
        logger.error(f"ClickHouse trace query failed: {str(e)}")
        return jsonify({"error": f"Failed to query traces: {str(e)}"}), 500

def get_traces_from_loki(tenant_id, limit):
    """Fallback: Query traces from Loki"""
    logql_query = f'{{tenant_id="{tenant_id}", parent_span_id=""}}'
    
    try:
        response = requests.get(
            f"{LOKI_URL}/loki/api/v1/query_range",
            params={
                "query": logql_query,
                "limit": limit,
                "start": int((datetime.now() - timedelta(hours=24)).timestamp() * 1e9),
                "end": int(datetime.now().timestamp() * 1e9)
            },
            timeout=10
        )
        response.raise_for_status()
        
        data = response.json()
        traces = []
        
        for stream in data.get('data', {}).get('result', []):
            labels = stream.get('stream', {})
            for value in stream.get('values', []):
                timestamp_ns = int(value[0])
                traces.append({
                    "traceID": labels.get('trace_id', 'unknown'),
                    "rootTraceName": labels.get('operation_name', 'unknown'),
                    "rootServiceName": labels.get('service_name', 'unknown'),
                    "startTimeUnixNano": str(timestamp_ns),
                    "durationMs": int(labels.get('duration_ms', 0)),
                    "status": labels.get('status', 'OK')
                })
        
        traces.sort(key=lambda x: int(x['startTimeUnixNano']), reverse=True)
        
        return jsonify({
            "tenant_id": tenant_id,
            "traces": traces,
            "count": len(traces),
            "source": "loki"
        }), 200
        
    except Exception as e:
        logger.error(f"Loki trace query failed: {str(e)}")
        return jsonify({"error": "Failed to query traces"}), 500

@app.route('/api/traces/<trace_id>', methods=['GET'])
@limiter.limit("100 per minute")
def get_trace_detail(trace_id):
    """Get detailed trace with all spans from ClickHouse"""
    try:
        # Fetch spans from ClickHouse
        db_spans = ch.get_trace_spans(trace_id)
        
        if not db_spans:
            return jsonify({"error": "Trace not found"}), 404

        spans = []
        for span in db_spans:
            start_ns = int(span['StartTimeUnixNano'])
            end_ns = int(span['EndTimeUnixNano'])
            duration_ms = (end_ns - start_ns) / 1_000_000
            
            # Helper to map OTel status to string if it's not already
            status_raw = span['StatusCode']
            status = status_raw if isinstance(status_raw, str) else "OK"
            
            spans.append({
                "spanId": span['SpanId'],
                "parentSpanId": span['ParentSpanId'],
                "operationName": span['Name'],
                "serviceName": span['ServiceName'],
                "startTimeUnixNano": str(start_ns),
                "durationMs": round(duration_ms, 2),
                "status": status,
                "attributes": span['SpanAttributes'] or {}
            })
            
        return jsonify({
            "traceId": trace_id,
            "spans": spans,
            "spanCount": len(spans)
        }), 200
            
    except Exception as e:
        logger.error(f"Failed to get trace detail from ClickHouse: {str(e)}")
        return jsonify({"error": f"Failed to get trace: {str(e)}"}), 500

@app.route('/api/traces/search', methods=['GET'])
def search_traces():
    """Search traces by trace_id or service in ClickHouse"""
    tenant_id = request.args.get('tenant_id')
    trace_id = request.args.get('trace_id')
    service = request.args.get('service', 'demo-app')
    limit = int(request.args.get('limit', '20'))
    
    if not tenant_id:
        return jsonify({"error": "tenant_id required"}), 400
    
    if not validate_tenant(tenant_id):
        return jsonify({"error": "Invalid or inactive tenant"}), 403
    
    try:
        if trace_id:
            # Direct Trace ID lookup
            spans = ch.get_trace_spans(trace_id)
            if spans:
                # Format as a list of traces (frontend expects this structure for search)
                # But search_traces usually returns a SUMMARY list, not detail.
                # However, if trace_id is specific, we might return the detail
                # The original code returned tempo/api/traces/{id} structure which is detail.
                # Let's reuse get_trace_detail logic or redirect?
                # Actually, the frontend calls this when you search for a specific ID in the search bar.
                # It expects the same format as get_traces (list) or get_trace_detail (object)?
                # The original code: return jsonify(response.json()) -> returns Tempo Trace format.
                
                # Let's return a list with 1 trace summary
                # We need to find the root span or just first span
                root_span = next((s for s in spans if s['ParentSpanId'] == ''), spans[0])
                
                return jsonify({
                    "traces": [{
                        "traceID": trace_id,
                        "rootTraceName": root_span['Name'],
                        "rootServiceName": root_span['ServiceName'],
                        "startTimeUnixNano": str(root_span['StartTimeUnixNano']),
                        "durationMs": root_span['DurationNano'] / 1_000_000,
                        "status": root_span['StatusCode']
                    }]
                }), 200
            else:
                 return jsonify({"error": "Trace not found"}), 404
        else:
            # Search by Service
            traces = ch.get_traces(
                tenant_id=tenant_id,
                service_name=service,
                limit=limit
            )
            
            result_traces = []
            for t in traces:
                result_traces.append({
                    "traceID": t['TraceId'],
                    "rootTraceName": t['RootTraceName'],
                    "rootServiceName": t['RootServiceName'],
                    "startTimeUnixNano": str(t['StartTimeUnixNano']),
                    "durationMs": t['DurationNano'] / 1_000_000,
                    "status": t['StatusCode']
                })
            
            return jsonify({"traces": result_traces}), 200
        
    except Exception as e:
        logger.error(f"ClickHouse search failed: {str(e)}")
        return jsonify({"error": f"Search failed: {str(e)}"}), 500

# ==================== CROSS-TELEMETRY CORRELATION ====================

@app.route('/api/correlate/<trace_id>', methods=['GET'])
@limiter.limit("60 per minute")
def correlate_telemetry(trace_id):
    """Get all correlated telemetry (trace, logs, metrics) for a trace_id using ClickHouse"""
    tenant_id = request.args.get('tenant_id')
    
    if not tenant_id:
        return jsonify({"error": "tenant_id query parameter required"}), 400
    
    if not validate_tenant(tenant_id):
        return jsonify({"error": "Invalid or inactive tenant"}), 403
    
    result = {
        "trace_id": trace_id,
        "tenant_id": tenant_id,
        "trace": None,
        "logs": [],
        "metrics": [],
        "timeline": []
    }
    
    try:
        # 1. Get trace spans
        db_spans = ch.get_trace_spans(trace_id)
        if not db_spans:
             return jsonify({"error": "Trace not found"}), 404
             
        # Extract time range from spans
        start_ns = min(int(s['StartTimeUnixNano']) for s in db_spans)
        end_ns = max(int(s['EndTimeUnixNano']) for s in db_spans)
        trace_duration_ms = (end_ns - start_ns) / 1_000_000
        
        # Format trace object
        spans = []
        for span in db_spans:
            s_start = int(span['StartTimeUnixNano'])
            s_end = int(span['EndTimeUnixNano'])
            spans.append({
                "spanId": span['SpanId'],
                "name": span['Name'],
                "startTime": s_start,
                "endTime": s_end,
                "duration_ms": (s_end - s_start) / 1_000_000,
                "status": span['StatusCode'],
                "attributes": span['SpanAttributes'] or {}
            })
            
            # Add spans to timeline
            result["timeline"].append({
                "type": "span",
                "timestamp": s_start,
                "data": {
                    "name": span['Name'],
                    "duration_ms": (s_end - s_start) / 1_000_000,
                    "status": "error" if span['StatusCode'] == "ERROR" else "ok"
                }
            })
            
        result["trace"] = {
            "traceId": trace_id,
            "spans": spans,
            "spanCount": len(spans),
            "duration_ms": trace_duration_ms
        }
        
        # 2. Get Logs (Exact correlation + Fuzzy fallback)
        logs = []
        seen_logs = set() # To prevent duplicates if we find same log via both methods

        # 2a. Exact Match (TraceID)
        log_query_exact = """
            SELECT Timestamp, SeverityText, Body, ServiceName, TraceId, ResourceAttributes
            FROM otel_logs
            WHERE TraceId = %(trace_id)s
            ORDER BY Timestamp ASC
        """
        exact_logs = ch.execute_query(log_query_exact, {'trace_id': trace_id})
        
        for log in exact_logs:
            # Create unique signature
            log_sig = (log['Timestamp'], log['Body'], log['ServiceName'])
            if log_sig not in seen_logs:
                seen_logs.add(log_sig)
                ts_ns = int(log['Timestamp'].timestamp() * 1e9)
                logs.append({
                    "timestamp": ts_ns,
                    "message": log['Body'],
                    "level": log['SeverityText'],
                    "service": log['ServiceName'],
                    "trace_id": log['TraceId'],
                    "correlation_type": "exact"
                })

        # 2b. Fuzzy Match (Time + Tenant + Service) - Only if exact matches are sparse (< 5)
        # or always? User requested "live users info" so let's do it always but mark as fuzzy.
        
        # Get services involved in trace
        trace_services = set(s['attributes'].get('service.name', 'unknown') for s in spans)
        trace_services.discard('unknown')
        
        if trace_services:
            # Expand window by 2 seconds
            fuzzy_start = datetime.fromtimestamp(start_ns / 1e9) - timedelta(seconds=2)
            fuzzy_end = datetime.fromtimestamp(end_ns / 1e9) + timedelta(seconds=2)
            
            # Manually format services for SQL IN clause to avoid driver parameter issues
            # Escape single quotes just in case
            formatted_services = ", ".join(f"'{s.replace(chr(39), chr(39)*2)}'" for s in trace_services)
            
            log_query_fuzzy = f"""
                SELECT Timestamp, SeverityText, Body, ServiceName, TraceId
                FROM otel_logs
                WHERE ResourceAttributes['tenant_id'] = %(tenant_id)s
                AND ServiceName IN ({formatted_services})
                AND Timestamp BETWEEN %(start)s AND %(end)s
                AND TraceId = '' -- Only get unrelated ones
                ORDER BY Timestamp ASC
                LIMIT 100
            """
            
            fuzzy_logs_raw = ch.execute_query(log_query_fuzzy, {
                'tenant_id': tenant_id,
                'start': fuzzy_start,
                'end': fuzzy_end
            })
            
            for log in fuzzy_logs_raw:
                ts_ns = int(log['Timestamp'].timestamp() * 1e9)
                log_sig = (log['Timestamp'], log['Body'], log['ServiceName'])
                
                if log_sig not in seen_logs:
                    seen_logs.add(log_sig)
                    logs.append({
                        "timestamp": ts_ns,
                        "message": log['Body'],
                        "level": log['SeverityText'],
                        "service": log['ServiceName'],
                        "trace_id": log['TraceId'] or "(inferred)",
                        "correlation_type": "fuzzy"
                    })

        # Sort combined logs by time
        logs.sort(key=lambda x: x['timestamp'])
        
        result["logs"] = logs
        
        # Add to timeline
        for log in logs:
             result["timeline"].append({
                "type": "log",
                "timestamp": log['timestamp'],
                "data": log
            })
            
        # 3. Get Metrics (Range based correlation)
        # Fetch metrics for the tenant within the trace duration
        start_dt = datetime.fromtimestamp(start_ns / 1e9)
        end_dt = datetime.fromtimestamp(end_ns / 1e9)
        
        # Expand window slightly
        start_window = start_dt - timedelta(seconds=10)
        end_window = end_dt + timedelta(seconds=10)
        
        metrics = ch.execute_query("""
            SELECT Timestamp, MetricName, Value, ResourceAttributes
            FROM otel_metrics_sum
            WHERE ResourceAttributes['tenant_id'] = %(tenant_id)s
              AND Timestamp BETWEEN %(start)s AND %(end)s
            LIMIT 50
        """, {
            'tenant_id': tenant_id,
            'start': start_window,
            'end': end_window,
            'metric_name': 'http.server.request.duration' # Example metric
        })
        
        result["metrics"] = metrics
        
        return jsonify(result)

    except Exception as e:
        logger.error(f"Error correlating trace {trace_id}: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# ==================== AI TRACE DOCTOR ====================

@app.route('/api/ai/diagnose/<trace_id>', methods=['GET'])
@limiter.limit("10 per minute") # Higher limit for AI
def diagnose_trace_endpoint(trace_id):
    """Diagnose a trace using GenAI (Trace Doctor)"""
    tenant_id = request.args.get('tenant_id')
    if not tenant_id:
        return jsonify({"error": "tenant_id required"}), 400
        
    if not validate_tenant(tenant_id):
        return jsonify({"error": "Invalid tenant"}), 403

    try:
        diagnosis = ai_agent.diagnose_trace(trace_id, tenant_id)
        if "error" in diagnosis:
            return jsonify(diagnosis), 500
            
        return jsonify(diagnosis)
    except Exception as e:
        logger.error(f"AI Diagnosis Error: {e}")
        return jsonify({"error": str(e)}), 500
            'tenant_id': tenant_id, 
            'start': start_window, 
            'end': end_window
        })
        
        for m in metrics:
            ts_ns = int(m['Timestamp'].timestamp() * 1e9)
            metric_entry = {
                "timestamp": ts_ns,
                "name": m['MetricName'],
                "value": m['Value'],
                "service": m['ResourceAttributes'].get('service_name', '')
            }
            result["metrics"].append(metric_entry)
            result["timeline"].append({
                "type": "metric",
                "timestamp": ts_ns,
                "data": metric_entry
            })
            
    except Exception as e:
        logger.error(f"Correlation failed: {e}")
        # Partial result is better than error
        
    # Sort timeline
    result["timeline"].sort(key=lambda x: x["timestamp"])
    
    # Calculate relative time
    if result["timeline"]:
        start_time = result["timeline"][0]["timestamp"]
        for item in result["timeline"]:
            item["relative_ms"] = (item["timestamp"] - start_time) / 1_000_000
            
    return jsonify(result), 200

# ==================== HEALTH CHECK ====================

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint with service status"""
    services_status = {}
    
    # Check Postgres
    try:
        conn = get_db_connection()
        if conn:
            conn.close()
            services_status['database'] = {'status': 'healthy'}
        else:
            services_status['database'] = {'status': 'unavailable'}
    except:
        services_status['database'] = {'status': 'unavailable'}
    
    # Check ClickHouse
    try:
        if ch.get_client():
            # Run simple query
            ch.execute_query("SELECT 1")
            services_status['clickhouse'] = {'status': 'healthy'}
        else:
             services_status['clickhouse'] = {'status': 'unavailable'}
    except Exception as e:
        services_status['clickhouse'] = {'status': 'unavailable', 'error': str(e)}
    
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "services": services_status
    }), 200

# ==================== UPTIME MONITORING ENDPOINTS ====================

@app.route('/api/uptime', methods=['GET'])
@limiter.limit("100 per minute")
def get_uptime():
    """Get real-time uptime percentage for a tenant"""
    tenant_id = request.args.get('tenant_id')
    hours = int(request.args.get('hours', '24'))
    
    if not tenant_id:
        return jsonify({"error": "tenant_id query parameter required"}), 400
    
    if not validate_tenant(tenant_id):
        return jsonify({"error": "Invalid or inactive tenant"}), 403
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database unavailable"}), 503
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Get overall uptime for tenant
            cur.execute("""
                SELECT 
                    COUNT(*) as total_checks,
                    SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) as successful_checks,
                    ROUND(SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END)::DECIMAL / NULLIF(COUNT(*), 0) * 100, 2) as uptime_percentage,
                    AVG(response_time_ms)::INTEGER as avg_response_ms
                FROM health_checks
                WHERE tenant_id = %s
                  AND checked_at > NOW() - INTERVAL '%s hours'
            """, (tenant_id, hours))
            result = cur.fetchone()
            
            # Get per-service breakdown
            cur.execute("""
                SELECT 
                    service_name,
                    COUNT(*) as total_checks,
                    SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) as successful_checks,
                    ROUND(SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END)::DECIMAL / NULLIF(COUNT(*), 0) * 100, 2) as uptime_percentage,
                    AVG(response_time_ms)::INTEGER as avg_response_ms
                FROM health_checks
                WHERE tenant_id = %s
                  AND checked_at > NOW() - INTERVAL '%s hours'
                GROUP BY service_name
                ORDER BY uptime_percentage ASC
            """, (tenant_id, hours))
            services = cur.fetchall()
            
            # Get ongoing outages
            cur.execute("""
                SELECT service_name, started_at, failure_count
                FROM outages
                WHERE tenant_id = %s AND status = 'ongoing'
            """, (tenant_id,))
            ongoing_outages = cur.fetchall()
            
            return jsonify({
                "tenant_id": tenant_id,
                "period_hours": hours,
                "uptime_percentage": float(result['uptime_percentage'] or 100),
                "total_checks": result['total_checks'] or 0,
                "successful_checks": result['successful_checks'] or 0,
                "avg_response_ms": result['avg_response_ms'] or 0,
                "services": [dict(s) for s in services],
                "ongoing_outages": [dict(o) for o in ongoing_outages],
                "status": "degraded" if ongoing_outages else "healthy"
            }), 200
            
    except Exception as e:
        logger.error(f"Failed to get uptime: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route('/api/uptime/history', methods=['GET'])
@limiter.limit("60 per minute")
def get_uptime_history():
    """Get daily uptime history for a tenant"""
    tenant_id = request.args.get('tenant_id')
    days = int(request.args.get('days', '30'))
    
    if not tenant_id:
        return jsonify({"error": "tenant_id query parameter required"}), 400
    
    if not validate_tenant(tenant_id):
        return jsonify({"error": "Invalid or inactive tenant"}), 403
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database unavailable"}), 503
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT 
                    DATE(checked_at) as date,
                    COUNT(*) as total_checks,
                    SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) as successful_checks,
                    ROUND(SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END)::DECIMAL / NULLIF(COUNT(*), 0) * 100, 2) as uptime_percentage,
                    AVG(response_time_ms)::INTEGER as avg_response_ms
                FROM health_checks
                WHERE tenant_id = %s
                  AND checked_at > NOW() - INTERVAL '%s days'
                GROUP BY DATE(checked_at)
                ORDER BY date DESC
            """, (tenant_id, days))
            history = cur.fetchall()
            
            return jsonify({
                "tenant_id": tenant_id,
                "period_days": days,
                "history": [dict(h) for h in history]
            }), 200
            
    except Exception as e:
        logger.error(f"Failed to get uptime history: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route('/api/endpoints', methods=['GET'])
@limiter.limit("60 per minute")
def get_endpoints():
    """Get monitored endpoints for a tenant"""
    tenant_id = request.args.get('tenant_id')
    
    if not tenant_id:
        return jsonify({"error": "tenant_id query parameter required"}), 400
    
    if not validate_tenant(tenant_id):
        return jsonify({"error": "Invalid or inactive tenant"}), 403
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database unavailable"}), 503
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT id, service_name, endpoint_url, check_interval_seconds, 
                       timeout_seconds, is_active, created_at
                FROM service_endpoints
                WHERE tenant_id = %s
                ORDER BY service_name
            """, (tenant_id,))
            endpoints = cur.fetchall()
            
            return jsonify({
                "tenant_id": tenant_id,
                "endpoints": [dict(e) for e in endpoints],
                "count": len(endpoints)
            }), 200
            
    except Exception as e:
        logger.error(f"Failed to get endpoints: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route('/api/endpoints', methods=['POST'])
@limiter.limit("30 per minute")
def create_endpoint():
    """Add a new endpoint to monitor"""
    data = request.get_json()
    
    tenant_id = data.get('tenant_id')
    service_name = data.get('service_name')
    endpoint_url = data.get('endpoint_url')
    
    if not all([tenant_id, service_name, endpoint_url]):
        return jsonify({"error": "tenant_id, service_name, and endpoint_url are required"}), 400
    
    if not validate_tenant(tenant_id):
        return jsonify({"error": "Invalid or inactive tenant"}), 403
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database unavailable"}), 503
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                INSERT INTO service_endpoints 
                    (tenant_id, service_name, endpoint_url, check_interval_seconds, timeout_seconds)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (tenant_id, service_name) 
                DO UPDATE SET endpoint_url = EXCLUDED.endpoint_url, updated_at = NOW()
                RETURNING id, service_name, endpoint_url, is_active
            """, (
                tenant_id,
                service_name,
                endpoint_url,
                data.get('check_interval_seconds', 60),
                data.get('timeout_seconds', 10)
            ))
            endpoint = cur.fetchone()
            conn.commit()
            
            logger.info(f"Endpoint created/updated: {tenant_id}/{service_name}")
            return jsonify({
                "message": "Endpoint created successfully",
                "endpoint": dict(endpoint)
            }), 201
            
    except Exception as e:
        logger.error(f"Failed to create endpoint: {e}")
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route('/api/endpoints/<int:endpoint_id>', methods=['DELETE'])
@limiter.limit("30 per minute")
def delete_endpoint(endpoint_id):
    """Delete a monitored endpoint"""
    tenant_id = request.args.get('tenant_id')
    
    if not tenant_id:
        return jsonify({"error": "tenant_id query parameter required"}), 400
    
    if not validate_tenant(tenant_id):
        return jsonify({"error": "Invalid or inactive tenant"}), 403
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database unavailable"}), 503
    
    try:
        with conn.cursor() as cur:
            cur.execute("""
                DELETE FROM service_endpoints 
                WHERE id = %s AND tenant_id = %s
                RETURNING id
            """, (endpoint_id, tenant_id))
            deleted = cur.fetchone()
            conn.commit()
            
            if deleted:
                return jsonify({"message": "Endpoint deleted"}), 200
            else:
                return jsonify({"error": "Endpoint not found"}), 404
            
    except Exception as e:
        logger.error(f"Failed to delete endpoint: {e}")
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route('/api/outages', methods=['GET'])
@limiter.limit("60 per minute")
def get_outages():
    """Get outage history for a tenant"""
    tenant_id = request.args.get('tenant_id')
    days = int(request.args.get('days', '30'))
    status_filter = request.args.get('status')  # 'ongoing', 'resolved', or None for all
    
    if not tenant_id:
        return jsonify({"error": "tenant_id query parameter required"}), 400
    
    if not validate_tenant(tenant_id):
        return jsonify({"error": "Invalid or inactive tenant"}), 403
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database unavailable"}), 503
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            query = """
                SELECT id, service_name, started_at, ended_at, 
                       duration_seconds, failure_count, status, root_cause
                FROM outages
                WHERE tenant_id = %s
                  AND started_at > NOW() - INTERVAL '%s days'
            """
            params = [tenant_id, days]
            
            if status_filter in ['ongoing', 'resolved']:
                query += " AND status = %s"
                params.append(status_filter)
            
            query += " ORDER BY started_at DESC"
            
            cur.execute(query, params)
            outages = cur.fetchall()
            
            # Calculate total downtime
            total_downtime = sum(o['duration_seconds'] or 0 for o in outages if o['status'] == 'resolved')
            
            return jsonify({
                "tenant_id": tenant_id,
                "period_days": days,
                "outages": [dict(o) for o in outages],
                "total_outages": len(outages),
                "ongoing_count": sum(1 for o in outages if o['status'] == 'ongoing'),
                "total_downtime_seconds": total_downtime
            }), 200
            
    except Exception as e:
        logger.error(f"Failed to get outages: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


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
                "query": "GET /api/traces?tenant_id=<id>&limit=<n>&hours=<n>",
                "search": "GET /api/traces/search?tenant_id=<id>&trace_id=<id>&service=<name>"
            },
            "health": "GET /health"
        }
    }), 200

# ==================== ADMIN ENDPOINTS ====================

ADMIN_TENANT_ID = "admin"

def require_admin(f):
    """Decorator to require admin access"""
    @wraps(f)
    def decorated(*args, **kwargs):
        # Check JWT token for admin
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header[7:]
            payload = verify_jwt_token(token)
            if payload and payload.get('tenant_id') == ADMIN_TENANT_ID:
                return f(*args, **kwargs)
        return jsonify({"error": "Admin access required"}), 403
    return decorated

@app.route('/api/admin/tenants', methods=['GET'])
@limiter.limit("30 per minute")
@require_admin
def admin_get_tenants():
    """Get all tenants with usage statistics (admin only)"""
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({"error": "Database connection failed"}), 500
        
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Get all non-admin tenants
            cur.execute("""
                SELECT 
                    tenant_id,
                    company_name,
                    email,
                    api_key,
                    is_active,
                    created_at,
                    last_login
                FROM tenants
                WHERE tenant_id != 'admin'
                ORDER BY created_at DESC
            """)
            tenants = cur.fetchall()
        
        conn.close()
        
        # Format response
        formatted_tenants = []
        for t in tenants:
            # Mask API key (show first 4 and last 4 chars)
            api_key = t.get('api_key', '')
            masked_key = f"{api_key[:7]}...{api_key[-4:]}" if len(api_key) > 12 else "***"
            
            formatted_tenants.append({
                "tenant_id": t['tenant_id'],
                "company_name": t['company_name'],
                "email": t.get('email', ''),
                "api_key_masked": masked_key,
                "is_active": t['is_active'],
                "created_at": t['created_at'].isoformat() if t.get('created_at') else None,
                "last_login": t['last_login'].isoformat() if t.get('last_login') else None
            })
        
        return jsonify({
            "tenants": formatted_tenants,
            "count": len(formatted_tenants)
        }), 200
        
    except Exception as e:
        logger.error(f"Admin get tenants failed: {str(e)}")
        return jsonify({"error": "Failed to fetch tenants"}), 500

@app.route('/api/admin/stats', methods=['GET'])
@limiter.limit("30 per minute")
@require_admin
def admin_get_stats():
    """Get platform-wide statistics (admin only)"""
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({"error": "Database connection failed"}), 500
        
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Count tenants
            cur.execute("SELECT COUNT(*) as count FROM tenants WHERE tenant_id != 'admin'")
            tenant_count = cur.fetchone()['count']
            
            # Count active tenants (logged in last 24h)
            cur.execute("""
                SELECT COUNT(*) as count FROM tenants 
                WHERE tenant_id != 'admin' 
                AND last_login > NOW() - INTERVAL '24 hours'
            """)
            active_count = cur.fetchone()['count']
        
        conn.close()
        
        # Get Tempo trace count
        trace_count = 0
        try:
            now = int(datetime.now().timestamp())
            start = now - 86400  # 24 hours ago
            resp = requests.get(
                f"{TEMPO_URL}/api/search",
                params={"limit": 1000, "start": start, "end": now},
                timeout=5
            )
            if resp.status_code == 200:
                data = resp.json()
                trace_count = len(data.get('traces', []))
        except:
            pass
        
        return jsonify({
            "total_tenants": tenant_count,
            "active_tenants_24h": active_count,
            "total_traces_24h": trace_count,
            "platform_status": "healthy"
        }), 200
        
    except Exception as e:
        logger.error(f"Admin get stats failed: {str(e)}")
        return jsonify({"error": "Failed to fetch stats"}), 500

@app.route('/api/admin/tenant/<tenant_id>/toggle', methods=['POST'])
@limiter.limit("10 per minute")
@require_admin
def admin_toggle_tenant(tenant_id):
    """Toggle tenant active status (admin only)"""
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({"error": "Database connection failed"}), 500
        
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                UPDATE tenants 
                SET is_active = NOT is_active 
                WHERE tenant_id = %s AND tenant_id != 'admin'
                RETURNING tenant_id, is_active
            """, (tenant_id,))
            result = cur.fetchone()
            conn.commit()
        
        conn.close()
        
        if result:
            return jsonify({
                "success": True,
                "tenant_id": result['tenant_id'],
                "is_active": result['is_active']
            }), 200
        else:
            return jsonify({"error": "Tenant not found"}), 404
            
    except Exception as e:
        logger.error(f"Admin toggle tenant failed: {str(e)}")
        return jsonify({"error": "Failed to toggle tenant"}), 500

# ==================== USER SETTINGS ENDPOINTS ====================

@app.route('/api/user/profile', methods=['GET'])
@limiter.limit("30 per minute")
@require_jwt
def get_user_profile():
    """Get current user's profile information"""
    try:
        tenant_id = g.tenant_id
        conn = get_db_connection()
        if not conn:
            return jsonify({"error": "Database connection failed"}), 500
        
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT tenant_id, company_name, email, api_key, created_at, last_login
                FROM tenants WHERE tenant_id = %s
            """, (tenant_id,))
            user = cur.fetchone()
        
        conn.close()
        
        if user:
            return jsonify({
                "tenant_id": user['tenant_id'],
                "company_name": user['company_name'],
                "email": user['email'],
                "api_key": user['api_key'],
                "created_at": user['created_at'].isoformat() if user['created_at'] else None,
                "last_login": user['last_login'].isoformat() if user['last_login'] else None
            }), 200
        else:
            return jsonify({"error": "User not found"}), 404
            
    except Exception as e:
        logger.error(f"Get profile failed: {str(e)}")
        return jsonify({"error": "Failed to get profile"}), 500

@app.route('/api/user/password', methods=['PUT'])
@limiter.limit("5 per minute")
@require_jwt
def change_password():
    """Change current user's password"""
    try:
        tenant_id = g.tenant_id
        data = request.get_json()
        
        current_password = data.get('current_password', '')
        new_password = data.get('new_password', '')
        
        if not current_password or not new_password:
            return jsonify({"error": "Current and new password required"}), 400
        
        if len(new_password) < 6:
            return jsonify({"error": "New password must be at least 6 characters"}), 400
        
        conn = get_db_connection()
        if not conn:
            return jsonify({"error": "Database connection failed"}), 500
        
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Verify current password
            cur.execute("SELECT password_hash FROM tenants WHERE tenant_id = %s", (tenant_id,))
            user = cur.fetchone()
            
            if not user or not bcrypt.checkpw(current_password.encode('utf-8'), user['password_hash'].encode('utf-8')):
                conn.close()
                return jsonify({"error": "Current password is incorrect"}), 401
            
            # Hash new password and update
            new_hash = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            cur.execute("UPDATE tenants SET password_hash = %s WHERE tenant_id = %s", (new_hash, tenant_id))
            conn.commit()
        
        conn.close()
        logger.info(f"Password changed for tenant: {tenant_id}")
        return jsonify({"success": True, "message": "Password changed successfully"}), 200
        
    except Exception as e:
        logger.error(f"Change password failed: {str(e)}")
        return jsonify({"error": "Failed to change password"}), 500

@app.route('/api/user/api-key', methods=['POST'])
@limiter.limit("3 per minute")
@require_jwt
def regenerate_api_key():
    """Regenerate current user's API key"""
    try:
        tenant_id = g.tenant_id
        
        # Generate new API key
        new_api_key = f"sk_{tenant_id}_{secrets.token_hex(16)}"
        
        conn = get_db_connection()
        if not conn:
            return jsonify({"error": "Database connection failed"}), 500
        
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                UPDATE tenants SET api_key = %s WHERE tenant_id = %s
                RETURNING api_key
            """, (new_api_key, tenant_id))
            result = cur.fetchone()
            conn.commit()
        
        conn.close()
        
        if result:
            logger.info(f"API key regenerated for tenant: {tenant_id}")
            return jsonify({
                "success": True,
                "api_key": result['api_key'],
                "message": "API key regenerated successfully"
            }), 200
        else:
            return jsonify({"error": "Failed to regenerate API key"}), 500
            
    except Exception as e:
        logger.error(f"Regenerate API key failed: {str(e)}")
        return jsonify({"error": "Failed to regenerate API key"}), 500

@app.route('/api/user/profile', methods=['PUT'])
@limiter.limit("10 per minute")
@require_jwt
def update_profile():
    """Update current user's profile (company name, email)"""
    try:
        tenant_id = g.tenant_id
        data = request.get_json()
        
        company_name = data.get('company_name')
        email = data.get('email')
        
        if not company_name and not email:
            return jsonify({"error": "No fields to update"}), 400
        
        conn = get_db_connection()
        if not conn:
            return jsonify({"error": "Database connection failed"}), 500
        
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            updates = []
            values = []
            
            if company_name:
                updates.append("company_name = %s")
                values.append(company_name)
            if email:
                updates.append("email = %s")
                values.append(email)
            
            values.append(tenant_id)
            
            cur.execute(f"""
                UPDATE tenants SET {', '.join(updates)} WHERE tenant_id = %s
                RETURNING company_name, email
            """, tuple(values))
            result = cur.fetchone()
            conn.commit()
        
        conn.close()
        
        if result:
            return jsonify({
                "success": True,
                "company_name": result['company_name'],
                "email": result['email'],
                "message": "Profile updated successfully"
            }), 200
        else:
            return jsonify({"error": "Failed to update profile"}), 500
            
    except Exception as e:
        logger.error(f"Update profile failed: {str(e)}")
        return jsonify({"error": "Failed to update profile"}), 500

# ==================== ERROR HANDLERS ====================

@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Endpoint not found"}), 404

@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal server error: {str(error)}")
    return jsonify({"error": "Internal server error"}), 500

# ==================== AI DEBUG ====================

from ai_debug import analyze_error_log

@app.route('/api/ai/debug', methods=['POST'])
@limiter.limit("30 per minute")
def ai_debug_log():
    """Analyze an error log using AI (Gemini)"""
    data = request.get_json()
    
    if not data:
        return jsonify({"error": "Request body required"}), 400
    
    tenant_id = data.get('tenant_id')
    log_message = data.get('log_message')
    log_level = data.get('log_level', 'error')
    service_name = data.get('service_name', '')
    additional_context = data.get('additional_context', '')
    
    if not tenant_id:
        return jsonify({"error": "tenant_id required"}), 400
    
    if not log_message:
        return jsonify({"error": "log_message required"}), 400
    
    if not validate_tenant(tenant_id):
        return jsonify({"error": "Invalid or inactive tenant"}), 403
    
    # Only allow debugging error logs
    if log_level.lower() not in ['error', 'err', 'fatal', 'critical']:
        return jsonify({"error": "AI debug is only available for error logs"}), 400
    
    # Call AI analysis
    result = analyze_error_log(
        log_message=log_message,
        log_level=log_level,
        service_name=service_name,
        additional_context=additional_context
    )
    
    if result["success"]:
        logger.info(f"AI debug for tenant {tenant_id}: {result['tokens_used']} tokens")
        return jsonify({
            "tenant_id": tenant_id,
            "analysis": result["analysis"],
            "tokens_used": result["tokens_used"],
            "estimated_cost": result["estimated_cost"]
        }), 200
    else:
        logger.warning(f"AI debug failed for tenant {tenant_id}: {result['error']}")
        return jsonify({
            "error": result["error"]
        }), 503

# ==================== DATA DELETION ====================

@app.route('/api/traces/delete', methods=['POST'])
@limiter.limit("10 per minute")
@require_jwt
def delete_traces():
    """Delete traces within a time range for a tenant"""
    data = request.get_json()
    tenant_id = data.get('tenant_id')
    start_time_str = data.get('start_time')  # ISO format: "2026-01-01T00:00:00"
    end_time_str = data.get('end_time')      # ISO format: "2026-01-05T23:59:59"
    
    if not all([tenant_id, start_time_str, end_time_str]):
        return jsonify({"error": "tenant_id, start_time, and end_time are required"}), 400
    
    # SECURITY: Verify authenticated user can access this tenant
    is_valid, error_response = verify_tenant_access(tenant_id)
    if not is_valid:
        return error_response
    
    try:
        # Parse time strings
        start_time = datetime.fromisoformat(start_time_str.replace('Z', '+00:00'))
        end_time = datetime.fromisoformat(end_time_str.replace('Z', '+00:00'))
        
        # Validate time range
        if start_time >= end_time:
            return jsonify({"error": "start_time must be before end_time"}), 400
        
        # Convert to Unix timestamps (nanoseconds for ClickHouse)
        start_nano = int(start_time.timestamp() * 1_000_000_000)
        end_nano = int(end_time.timestamp() * 1_000_000_000)
        
        # Count traces before deletion (for confirmation)
        count_query = f"""
            SELECT count(*) as cnt 
            FROM otel_traces 
            WHERE ResourceAttributes['tenant_id'] = '{tenant_id}'
            AND Timestamp >= toDateTime64({start_nano / 1_000_000_000}, 9)
            AND Timestamp <= toDateTime64({end_nano / 1_000_000_000}, 9)
        """
        count_result = ch.get_client().query(count_query)
        traces_to_delete = count_result.result_rows[0][0] if count_result.result_rows else 0
        
        # Execute deletion asynchronously then wait
        delete_query = f"""
            ALTER TABLE otel_traces DELETE 
            WHERE ResourceAttributes['tenant_id'] = '{tenant_id}'
            AND Timestamp >= toDateTime64({start_nano / 1_000_000_000}, 9)
            AND Timestamp <= toDateTime64({end_nano / 1_000_000_000}, 9)
        """
        ch.get_client().command(delete_query)
        
        # Poll for mutation completion (max 10 seconds)
        import time
        max_retries = 20
        for _ in range(max_retries):
            # Check if there are any unfinished mutations for this table
            check_mutation = f"""
                SELECT count(*) 
                FROM system.mutations 
                WHERE database = currentDatabase() 
                AND table = 'otel_traces' 
                AND is_done = 0
            """
            pending_mutations = ch.get_client().query(check_mutation).result_rows[0][0]
            if pending_mutations == 0:
                break
            time.sleep(0.5)

        # Double check that the data is ACTUALLY gone
        final_check = ch.get_client().query(count_query)
        remaining = final_check.result_rows[0][0] if final_check.result_rows else 0
        
        if remaining > 0:
            # If still remaining, force a partition drop (nuclear option) if count is small? 
            # No, that's too dangerous. Just return partial success or warning.
            pass

        logger.info(f"Deleted {traces_to_delete} traces for tenant {tenant_id} from {start_time_str} to {end_time_str}")
        
        return jsonify({
            "success": True, 
            "message": f"Deleted {traces_to_delete} traces",
            "deleted_count": traces_to_delete,
            "remaining": remaining
        }), 200
        
    except ValueError as e:
        return jsonify({"error": f"Invalid time format: {str(e)}"}), 400
    except Exception as e:
        logger.error(f"Trace deletion failed: {str(e)}")
        return jsonify({"error": f"Failed to delete traces: {str(e)}"}), 500

@app.route('/api/logs/delete', methods=['POST'])
@limiter.limit("10 per minute")
@require_jwt
def delete_logs():
    """Delete logs within a time range for a tenant"""
    data = request.get_json()
    tenant_id = data.get('tenant_id')
    start_time_str = data.get('start_time')
    end_time_str = data.get('end_time')
    
    if not all([tenant_id, start_time_str, end_time_str]):
        return jsonify({"error": "tenant_id, start_time, and end_time are required"}), 400
    
    is_valid, error_response = verify_tenant_access(tenant_id)
    if not is_valid:
        return error_response
    
    try:
        start_time = datetime.fromisoformat(start_time_str.replace('Z', '+00:00'))
        end_time = datetime.fromisoformat(end_time_str.replace('Z', '+00:00'))
        
        if start_time >= end_time:
            return jsonify({"error": "start_time must be before end_time"}), 400
        
        start_nano = int(start_time.timestamp() * 1_000_000_000)
        end_nano = int(end_time.timestamp() * 1_000_000_000)
        
        # Count logs before deletion
        count_query = f"""
            SELECT count(*) as cnt 
            FROM otel_logs 
            WHERE ResourceAttributes['tenant_id'] = '{tenant_id}'
            AND Timestamp >= toDateTime64({start_nano / 1_000_000_000}, 9)
            AND Timestamp <= toDateTime64({end_nano / 1_000_000_000}, 9)
        """
        count_result = ch.get_client().query(count_query)
        logs_to_delete = count_result.result_rows[0][0] if count_result.result_rows else 0
        
        # Execute deletion
        delete_query = f"""
            ALTER TABLE otel_logs DELETE 
            WHERE ResourceAttributes['tenant_id'] = '{tenant_id}'
            AND Timestamp >= toDateTime64({start_nano / 1_000_000_000}, 9)
            AND Timestamp <= toDateTime64({end_nano / 1_000_000_000}, 9)
        """
        ch.get_client().command(delete_query)
        
        logger.info(f"Deleted {logs_to_delete} logs for tenant {tenant_id} from {start_time_str} to {end_time_str}")
        
        return jsonify({
            "success": True,
            "deleted_count": logs_to_delete,
            "tenant_id": tenant_id,
            "time_range": {
                "start": start_time_str,
                "end": end_time_str
            }
        }), 200
        
    except ValueError as e:
        return jsonify({"error": f"Invalid time format: {str(e)}"}), 400
    except Exception as e:
        logger.error(f"Log deletion failed: {str(e)}")
        return jsonify({"error": f"Failed to delete logs: {str(e)}"}), 500

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

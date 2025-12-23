#!/usr/bin/env python3
"""
Continuous demo data generator for SkyView
Runs in background and sends logs, metrics, and traces continuously
"""

import requests
import time
import random
import uuid
import signal
import sys
from datetime import datetime

LOKI_URL = "http://localhost:3100"

# Graceful shutdown
running = True
def signal_handler(sig, frame):
    global running
    print("\n\n🛑 Stopping generator...")
    running = False

signal.signal(signal.SIGINT, signal_handler)

def send_log():
    """Send a single log entry"""
    tenants = ['acme', 'globex', 'initech']
    services = ['web-app', 'api-server', 'database-proxy', 'auth-service']
    levels = ['info', 'info', 'info', 'warn', 'error']  # Weighted towards info
    
    messages = {
        'info': ['Request completed', 'User authenticated', 'Cache hit', 'Health check OK', 'Connection established'],
        'warn': ['Slow query detected', 'High memory usage', 'Rate limit warning', 'Cache miss'],
        'error': ['Connection timeout', 'Authentication failed', 'Service unavailable', 'Internal error']
    }
    
    tenant = random.choice(tenants)
    service = random.choice(services)
    level = random.choice(levels)
    message = random.choice(messages[level])
    
    payload = {
        "streams": [{
            "stream": {
                "job": "demo-app",
                "tenant_id": tenant,
                "service_name": service,
                "level": level,
                "endpoint": f"/api/{random.choice(['users', 'orders', 'products'])}",
                "method": random.choice(['GET', 'POST', 'PUT', 'DELETE']),
                "status": str(random.choice([200, 201, 400, 500])) if level == 'error' else '200'
            },
            "values": [[str(int(time.time() * 1e9)), message]]
        }]
    }
    
    try:
        response = requests.post(f"{LOKI_URL}/loki/api/v1/push", json=payload, timeout=5)
        return response.status_code == 204, tenant, level, service
    except:
        return False, tenant, level, service

def send_metric():
    """Send a single metric"""
    tenants = ['acme', 'globex', 'initech']
    metrics = ['http_requests_total', 'http_errors_total', 'http_response_time_seconds']
    
    tenant = random.choice(tenants)
    metric_name = random.choice(metrics)
    
    if metric_name == 'http_requests_total':
        value = random.randint(1, 50)
    elif metric_name == 'http_errors_total':
        value = random.randint(0, 5)
    else:
        value = round(random.uniform(0.05, 1.5), 3)
    
    payload = {
        "streams": [{
            "stream": {
                "job": "metrics-app",
                "tenant_id": tenant,
                "metric_name": metric_name,
                "service_name": "metrics-app",
                "endpoint": f"/api/{random.choice(['users', 'orders'])}",
                "status": str(random.choice([200, 201, 400, 500]))
            },
            "values": [[str(int(time.time() * 1e9)), f"{metric_name}={value}"]]
        }]
    }
    
    try:
        response = requests.post(f"{LOKI_URL}/loki/api/v1/push", json=payload, timeout=5)
        return response.status_code == 204, tenant, metric_name, value
    except:
        return False, tenant, metric_name, value

def send_trace():
    """Send a single trace"""
    tenants = ['acme', 'globex', 'initech']
    operations = ['HTTP GET /api/users', 'HTTP POST /api/orders', 'HTTP GET /api/products']
    
    tenant = random.choice(tenants)
    trace_id = uuid.uuid4().hex[:32]
    operation = random.choice(operations)
    duration = random.randint(50, 500)
    
    payload = {
        "streams": [{
            "stream": {
                "job": "traces-app",
                "tenant_id": tenant,
                "trace_type": "span",
                "trace_id": trace_id,
                "span_id": uuid.uuid4().hex[:16],
                "parent_span_id": "",
                "service_name": "api-gateway",
                "operation_name": operation,
                "duration_ms": str(duration),
                "status": random.choice(['OK', 'OK', 'OK', 'ERROR'])
            },
            "values": [[str(int(time.time() * 1e9)), f"trace={trace_id} duration={duration}ms"]]
        }]
    }
    
    try:
        response = requests.post(f"{LOKI_URL}/loki/api/v1/push", json=payload, timeout=5)
        return response.status_code == 204, tenant, trace_id[:8]
    except:
        return False, tenant, trace_id[:8]

if __name__ == "__main__":
    print("=" * 60)
    print("🚀 SkyView Continuous Data Generator")
    print("=" * 60)
    print(f"📡 Sending to: {LOKI_URL}")
    print("⏹️  Press Ctrl+C to stop\n")
    
    stats = {'logs': 0, 'metrics': 0, 'traces': 0, 'errors': 0}
    start_time = time.time()
    
    while running:
        try:
            # Send logs (most frequent)
            for _ in range(3):
                ok, tenant, level, service = send_log()
                if ok:
                    stats['logs'] += 1
                    print(f"📊 LOG   | {tenant:8} | {level.upper():5} | {service}")
                else:
                    stats['errors'] += 1
            
            # Send metrics (less frequent)
            ok, tenant, metric, value = send_metric()
            if ok:
                stats['metrics'] += 1
                print(f"📈 METRIC| {tenant:8} | {metric}={value}")
            else:
                stats['errors'] += 1
            
            # Send traces (least frequent)
            if random.random() > 0.5:
                ok, tenant, trace_id = send_trace()
                if ok:
                    stats['traces'] += 1
                    print(f"🔗 TRACE | {tenant:8} | {trace_id}...")
                else:
                    stats['errors'] += 1
            
            # Stats every 30 seconds
            elapsed = int(time.time() - start_time)
            if elapsed > 0 and elapsed % 30 == 0:
                print(f"\n📊 Stats: {stats['logs']} logs, {stats['metrics']} metrics, {stats['traces']} traces ({stats['errors']} errors)\n")
            
            time.sleep(2)  # Wait 2 seconds between batches
            
        except KeyboardInterrupt:
            break
        except Exception as e:
            stats['errors'] += 1
            print(f"❌ Error: {e}")
            time.sleep(5)
    
    print(f"\n📊 Final Stats:")
    print(f"   Logs: {stats['logs']}")
    print(f"   Metrics: {stats['metrics']}")
    print(f"   Traces: {stats['traces']}")
    print(f"   Errors: {stats['errors']}")
    print(f"   Runtime: {int(time.time() - start_time)}s")
    print("\n✅ Generator stopped")

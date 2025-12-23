#!/usr/bin/env python3
"""
Quick demo data generator for SkyView
Sends logs and metrics to the observability stack
"""

import requests
import time
import random
from datetime import datetime

LOKI_URL = "http://localhost:3100"

def send_logs():
    """Send demo logs to Loki"""
    tenants = ['acme', 'globex', 'initech']
    services = ['web-app', 'api-server', 'database-proxy', 'auth-service']
    levels = ['info', 'warn', 'error']
    
    messages = {
        'info': [
            'User authentication successful',
            'Database connection established',
            'Cache hit for user data',
            'Request completed successfully',
            'Health check passed'
        ],
        'warn': [
            'High memory usage detected',
            'Slow database query detected',
            'Rate limit approaching threshold',
            'Cache miss - fetching from database'
        ],
        'error': [
            'Database connection timeout',
            'Failed to authenticate user',
            'Service unavailable',
            'Internal server error',
            'Failed to process request'
        ]
    }
    
    for _ in range(20):
        tenant = random.choice(tenants)
        service = random.choice(services)
        level = random.choice(levels)
        message = random.choice(messages[level])
        
        timestamp_ns = int(time.time() * 1e9)
        
        payload = {
            "streams": [{
                "stream": {
                    "job": "demo-app",
                    "tenant_id": tenant,
                    "service_name": service,
                    "level": level,
                    "endpoint": f"/api/{random.choice(['users', 'orders', 'products'])}",
                    "method": random.choice(['GET', 'POST', 'PUT']),
                    "status": str(random.choice([200, 201, 400, 500])) if level == 'error' else '200'
                },
                "values": [[str(timestamp_ns), message]]
            }]
        }
        
        try:
            response = requests.post(f"{LOKI_URL}/loki/api/v1/push", json=payload)
            if response.status_code == 204:
                print(f"✓ Sent {level.upper()} log for {tenant}/{service}")
            else:
                print(f"✗ Failed: {response.status_code}")
        except Exception as e:
            print(f"✗ Error: {e}")
        
        time.sleep(0.2)

def send_metrics():
    """Send demo metrics to Loki (stored as structured logs)"""
    tenants = ['acme', 'globex', 'initech']
    metrics = ['http_requests_total', 'http_errors_total', 'http_response_time_seconds']
    
    for _ in range(15):
        tenant = random.choice(tenants)
        metric_name = random.choice(metrics)
        
        if metric_name == 'http_requests_total':
            value = random.randint(10, 100)
        elif metric_name == 'http_errors_total':
            value = random.randint(0, 10)
        else:  # response_time
            value = round(random.uniform(0.1, 2.0), 3)
        
        timestamp_ns = int(time.time() * 1e9)
        
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
                "values": [[str(timestamp_ns), f"{metric_name}={value}"]]
            }]
        }
        
        try:
            response = requests.post(f"{LOKI_URL}/loki/api/v1/push", json=payload)
            if response.status_code == 204:
                print(f"✓ Sent metric {metric_name}={value} for {tenant}")
            else:
                print(f"✗ Failed: {response.status_code}")
        except Exception as e:
            print(f"✗ Error: {e}")
        
        time.sleep(0.2)

def send_traces():
    """Send demo traces (stored as structured logs in Loki)"""
    import uuid
    
    tenants = ['acme', 'globex', 'initech']
    operations = ['HTTP GET /api/users', 'HTTP POST /api/orders', 'HTTP GET /api/products', 'Database Query', 'Cache Lookup']
    services = ['api-gateway', 'user-service', 'order-service', 'database-proxy', 'cache-service']
    
    for _ in range(10):
        tenant = random.choice(tenants)
        trace_id = uuid.uuid4().hex[:32]
        root_span_id = uuid.uuid4().hex[:16]
        
        root_operation = random.choice(operations[:3])
        root_service = 'api-gateway'
        root_duration = random.randint(50, 500)
        
        timestamp_ns = int(time.time() * 1e9)
        
        payload = {
            "streams": [{
                "stream": {
                    "job": "traces-app",
                    "tenant_id": tenant,
                    "trace_type": "span",
                    "trace_id": trace_id,
                    "span_id": root_span_id,
                    "parent_span_id": "",
                    "service_name": root_service,
                    "operation_name": root_operation,
                    "duration_ms": str(root_duration),
                    "status": random.choice(['OK', 'OK', 'OK', 'ERROR'])
                },
                "values": [[str(timestamp_ns), f"trace={trace_id} service={root_service} duration={root_duration}ms"]]
            }]
        }
        
        try:
            response = requests.post(f"{LOKI_URL}/loki/api/v1/push", json=payload)
            if response.status_code == 204:
                print(f"✓ Sent trace {trace_id[:8]}... for {tenant}/{root_service}")
            else:
                print(f"✗ Failed: {response.status_code}")
        except Exception as e:
            print(f"✗ Error: {e}")
        
        time.sleep(0.3)

if __name__ == "__main__":
    print("=" * 60)
    print("🚀 SkyView Demo Data Generator")
    print("=" * 60)
    
    print("\n📊 Generating Logs...")
    send_logs()
    
    print("\n📈 Generating Metrics...")
    send_metrics()
    
    print("\n🔗 Generating Traces...")
    send_traces()
    
    print("\n✅ Demo data generation complete!")
    print("\n🌐 View your data at: http://localhost:3001")
    print("🔑 Login: acme / demo123\n")

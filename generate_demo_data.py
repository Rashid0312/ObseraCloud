#!/usr/bin/env python3
"""
ObseraCloud Demo Data Generator (OTLP Version)
Sends OTLP Traces, Logs, and Metrics to the OTel Collector.
This serves as a reference implementation for customer applications.
"""

import requests
import time
import random
import uuid
import json
from datetime import datetime

# Pointing to OTel Collector HTTP Receiver
# Use env var or default to localhost
import os
OTEL_COLLECTOR_URL = os.getenv("OTEL_COLLECTOR_URL", "http://localhost:4318")

TENANTS = ['acme', 'globex', 'initech', 'Tourni1010', 'rosseta']
SERVICES = ['web-app', 'api-server', 'payment-service', 'inventory-service']

# ==========================================
# HELPERS
# ==========================================

def get_base_resource(tenant_id, service_name):
    """
    CRITICAL: All payloads MUST include 'tenant_id' in resource attributes.
    This is how SkyView segregates data.
    """
    return {
        "attributes": [
            {"key": "service.name", "value": {"stringValue": service_name}},
            {"key": "tenant_id", "value": {"stringValue": tenant_id}},
            {"key": "deployment.environment", "value": {"stringValue": "production"}},
            {"key": "host.name", "value": {"stringValue": "demo-host-01"}}
        ]
    }

def send_to_collector(endpoint, payload):
    try:
        url = f"{OTEL_COLLECTOR_URL}/v1/{endpoint}"
        response = requests.post(
            url,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=5
        )
        if response.status_code in [200, 202]:
            return True
        else:
            print(f"✗ Failed to send to {url}: {response.status_code} {response.text}")
            return False
    except Exception as e:
        print(f"✗ Connection Error: {e}")
        return False

# ==========================================
# LOGS GENERATOR
# ==========================================

def send_logs(count=10):
    print(f"  > Sending {count} Logs...")
    
    log_messages = {
        'INFO': ['User logged in', 'Payment processed', 'Item added to cart', 'Search executed'],
        'WARN': ['High latency detected', 'Memory usage > 80%', 'Rate limit approaching'],
        'ERROR': ['Database connection failed', 'Payment gateway timeout', 'NullPointerException']
    }
    
    severity_map = {'INFO': 9, 'WARN': 13, 'ERROR': 17}
    
    for _ in range(count):
        tenant = random.choice(TENANTS)
        service = random.choice(SERVICES)
        level = random.choice(list(log_messages.keys()))
        message = random.choice(log_messages[level])
        ts_nano = str(int(time.time() * 1e9))
        
        payload = {
            "resourceLogs": [{
                "resource": get_base_resource(tenant, service),
                "scopeLogs": [{
                    "scope": {"name": "demo-logger", "version": "1.0.0"},
                    "logRecords": [{
                        "timeUnixNano": ts_nano,
                        "observedTimeUnixNano": ts_nano,
                        "severityNumber": severity_map[level],
                        "severityText": level,
                        "body": {"stringValue": f"{message} [{uuid.uuid4().hex[:8]}]"},
                        "attributes": [
                            {"key": "http.method", "value": {"stringValue": random.choice(["GET", "POST"])}},
                            {"key": "http.path", "value": {"stringValue": "/api/v1/action"}},
                            {"key": "user.id", "value": {"stringValue": f"u-{random.randint(100, 999)}"}}
                        ],
                        "traceId": "", # Could correlate if we generated traces together
                        "spanId": ""
                    }]
                }]
            }]
        }
        
        if send_to_collector("logs", payload):
            print(f"    ✓ Log sent: [{tenant}] {level} - {message}")
        time.sleep(0.1)

# ==========================================
# TRACES GENERATOR
# ==========================================

def send_traces(count=5):
    print(f"  > Sending {count} Traces...")
    
    operations = ["checkout", "login", "search_items", "view_profile"]
    
    for _ in range(count):
        tenant = random.choice(TENANTS)
        service = random.choice(SERVICES)
        operation = random.choice(operations)
        
        trace_id = uuid.uuid4().hex
        span_id = uuid.uuid4().hex[:16] # 16 chars/8 bytes hex
        
        start_time = int(time.time() * 1e9)
        duration = random.randint(10, 500) * 1_000_000 # ms to ns
        end_time = start_time + duration
        
        status_code = 2 # ERROR
        if random.random() > 0.2:
            status_code = 1 # OK

        payload = {
            "resourceSpans": [{
                "resource": get_base_resource(tenant, service),
                "scopeSpans": [{
                    "scope": {"name": "demo-tracer"},
                    "spans": [{
                        "traceId": trace_id,
                        "spanId": span_id,
                        "parentSpanId": "", # Root span
                        "name": operation,
                        "kind": 2, # SPAN_KIND_SERVER
                        "startTimeUnixNano": str(start_time),
                        "endTimeUnixNano": str(end_time),
                        "status": {
                            "code": status_code,
                            "message": "Error processing request" if status_code == 2 else ""
                        },
                        "attributes": [
                            {"key": "http.status_code", "value": {"intValue": 500 if status_code == 2 else 200}},
                            {"key": "http.url", "value": {"stringValue": f"https://api.myapp.com/{operation}"}}
                        ]
                    }]
                }]
            }]
        }
        
        if send_to_collector("traces", payload):
            print(f"    ✓ Trace sent: [{tenant}] {operation} ({duration//1_000_000}ms)")
        time.sleep(0.2)

# ==========================================
# METRICS GENERATOR
# ==========================================

def send_metrics(count=10):
    print(f"  > Sending {count} Metrics...")
    
    metric_names = ["http.server.duration", "http.requests.total", "system.memory.usage"]
    
    for _ in range(count):
        tenant = random.choice(TENANTS)
        service = random.choice(SERVICES)
        metric_name = random.choice(metric_names)
        
        value = random.randint(1, 100)
        ts_nano = str(int(time.time() * 1e9))
        
        # Determine metric type (simplified for demo)
        if metric_name.endswith("total"):
             # Sum/Counter
             metric_data = {
                "name": metric_name,
                "sum": {
                    "dataPoints": [{
                        "startTimeUnixNano": ts_nano,
                        "timeUnixNano": ts_nano,
                        "asInt": str(value), # Counter usually aggregated
                        "attributes": [
                             {"key": "method", "value": {"stringValue": "POST"}}
                        ]
                    }],
                    "aggregationTemporality": 2, # Cumulative
                    "isMonotonic": True
                }
             }
        else:
            # Gauge
            metric_data = {
                "name": metric_name,
                "gauge": {
                    "dataPoints": [{
                         "timeUnixNano": ts_nano,
                         "asDouble": float(value),
                         "attributes": [
                             {"key": "host", "value": {"stringValue": "web-01"}}
                         ]
                    }]
                }
            }

        payload = {
            "resourceMetrics": [{
                "resource": get_base_resource(tenant, service),
                "scopeMetrics": [{
                    "scope": {"name": "demo-metrics"},
                    "metrics": [metric_data]
                }]
            }]
        }
        
        if send_to_collector("metrics", payload):
            print(f"    ✓ Metric sent: [{tenant}] {metric_name} = {value}")
        time.sleep(0.1)

# ==========================================
# MAIN
# ==========================================

if __name__ == "__main__":
    print("="*60)
    print("🚀 ObseraCloud OTLP Demo Generator")
    print(f"🎯 Target: {OTEL_COLLECTOR_URL}")
    print("="*60)
    
    print("\n[1/3] Generating Logs...")
    send_logs(10)
    
    print("\n[2/3] Generating Traces...")
    send_traces(5)
    
    print("\n[3/3] Generating Metrics...")
    send_metrics(10)
    
    print("\n✅ Done! Check SkyView Dashboard.")


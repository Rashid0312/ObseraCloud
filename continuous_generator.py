#!/usr/bin/env python3
"""
Correlated Telemetry Generator for ObseraCloud
Generates logs, metrics, and traces that correlate with each other.
Each "request" generates all 3 types of telemetry with the same trace_id.
"""

import requests
import time
import random
import uuid
import signal
import sys
from datetime import datetime

LOKI_URL = "http://localhost:3100"
TEMPO_URL = "http://localhost:4320"

# Graceful shutdown
running = True
def signal_handler(sig, frame):
    global running
    print("\n\n🛑 Stopping generator...")
    running = False

signal.signal(signal.SIGINT, signal_handler)

# Request simulation configuration
ENDPOINTS = [
    {"path": "/api/users", "method": "GET", "service": "user-service"},
    {"path": "/api/users", "method": "POST", "service": "user-service"},
    {"path": "/api/orders", "method": "GET", "service": "order-service"},
    {"path": "/api/orders", "method": "POST", "service": "order-service"},
    {"path": "/api/products", "method": "GET", "service": "product-service"},
    {"path": "/api/auth/login", "method": "POST", "service": "auth-service"},
]

TENANTS = ['acme', 'globex', 'initech']

def simulate_request(tenant: str = None):
    """
    Simulate a single HTTP request and generate correlated telemetry.
    Returns: (success, request_context)
    """
    # Generate shared context for this request
    trace_id = uuid.uuid4().hex[:32]
    span_id = uuid.uuid4().hex[:16]
    timestamp_ns = str(int(time.time() * 1e9))
    tenant = tenant or random.choice(TENANTS)
    endpoint = random.choice(ENDPOINTS)
    
    # Determine if this request succeeds or fails
    is_error = random.random() < 0.08  # 8% error rate
    status_code = random.choice([400, 401, 500, 502, 503]) if is_error else random.choice([200, 201])
    duration_ms = random.randint(50, 300) if not is_error else random.randint(500, 2000)
    
    # Build request context
    ctx = {
        "trace_id": trace_id,
        "span_id": span_id,
        "tenant_id": tenant,
        "service": endpoint["service"],
        "method": endpoint["method"],
        "path": endpoint["path"],
        "status_code": status_code,
        "duration_ms": duration_ms,
        "is_error": is_error,
        "timestamp_ns": timestamp_ns
    }
    
    # Generate all correlated telemetry
    log_ok = send_correlated_log(ctx)
    metric_ok = send_correlated_metrics(ctx)
    trace_ok = send_correlated_trace(ctx)
    
    return (log_ok and metric_ok and trace_ok), ctx


def send_correlated_log(ctx: dict) -> bool:
    """Send log entry correlated with the request"""
    level = "error" if ctx["is_error"] else random.choice(["info", "info", "info", "warn"])
    
    if ctx["is_error"]:
        messages = [
            f"Request failed: {ctx['method']} {ctx['path']} returned {ctx['status_code']}",
            f"Error processing request: timeout after {ctx['duration_ms']}ms",
            f"Service error: {ctx['service']} unavailable",
        ]
        message = random.choice(messages)
    else:
        messages = [
            f"Request completed: {ctx['method']} {ctx['path']} - {ctx['status_code']} ({ctx['duration_ms']}ms)",
            f"Processed request for {ctx['path']}",
            f"Request handled by {ctx['service']}",
        ]
        message = random.choice(messages)
    
    payload = {
        "streams": [{
            "stream": {
                "job": "demo-app",
                "tenant_id": ctx["tenant_id"],
                "service_name": ctx["service"],
                "level": level,
                "endpoint": ctx["path"],
                "method": ctx["method"],
                "status": str(ctx["status_code"]),
                "trace_id": ctx["trace_id"],  # Key for correlation!
            },
            "values": [[ctx["timestamp_ns"], message]]
        }]
    }
    
    try:
        response = requests.post(f"{LOKI_URL}/loki/api/v1/push", json=payload, timeout=5)
        return response.status_code == 204
    except:
        return False


def send_correlated_metrics(ctx: dict) -> bool:
    """Send metrics correlated with the request"""
    metrics_batch = []
    
    # Request count metric
    metrics_batch.append({
        "stream": {
            "job": "metrics-app",
            "tenant_id": ctx["tenant_id"],
            "metric_name": "http_requests_total",
            "service_name": ctx["service"],
            "endpoint": ctx["path"],
            "method": ctx["method"],
            "status": str(ctx["status_code"]),
        },
        "values": [[ctx["timestamp_ns"], "http_requests_total=1"]]
    })
    
    # Response time metric
    metrics_batch.append({
        "stream": {
            "job": "metrics-app",
            "tenant_id": ctx["tenant_id"],
            "metric_name": "http_response_time_seconds",
            "service_name": ctx["service"],
            "endpoint": ctx["path"],
        },
        "values": [[ctx["timestamp_ns"], f"http_response_time_seconds={ctx['duration_ms']/1000:.3f}"]]
    })
    
    # Error metric (only if error)
    if ctx["is_error"]:
        metrics_batch.append({
            "stream": {
                "job": "metrics-app",
                "tenant_id": ctx["tenant_id"],
                "metric_name": "http_errors_total",
                "service_name": ctx["service"],
                "endpoint": ctx["path"],
                "status": str(ctx["status_code"]),
            },
            "values": [[ctx["timestamp_ns"], "http_errors_total=1"]]
        })
    
    payload = {"streams": metrics_batch}
    
    try:
        response = requests.post(f"{LOKI_URL}/loki/api/v1/push", json=payload, timeout=5)
        return response.status_code == 204
    except:
        return False


def send_correlated_trace(ctx: dict) -> bool:
    """Send trace correlated with the request"""
    # Store trace in Loki for now (Tempo trace ingest would be via OTLP)
    payload = {
        "streams": [{
            "stream": {
                "job": "traces-app",
                "tenant_id": ctx["tenant_id"],
                "trace_type": "span",
                "trace_id": ctx["trace_id"],
                "span_id": ctx["span_id"],
                "parent_span_id": "",
                "service_name": ctx["service"],
                "operation_name": f"{ctx['method']} {ctx['path']}",
                "duration_ms": str(ctx["duration_ms"]),
                "status": "ERROR" if ctx["is_error"] else "OK",
                "http_status": str(ctx["status_code"]),
            },
            "values": [[ctx["timestamp_ns"], f"trace={ctx['trace_id']} duration={ctx['duration_ms']}ms status={ctx['status_code']}"]]
        }]
    }
    
    try:
        response = requests.post(f"{LOKI_URL}/loki/api/v1/push", json=payload, timeout=5)
        return response.status_code == 204
    except:
        return False


if __name__ == "__main__":
    print("=" * 60)
    print("🚀 ObseraCloud Correlated Telemetry Generator")
    print("=" * 60)
    print(f"📡 Loki URL: {LOKI_URL}")
    print("📊 Each request generates correlated: Log + Metrics + Trace")
    print("⏹️  Press Ctrl+C to stop\n")
    
    stats = {
        'requests': 0,
        'errors': 0,
        'failed_sends': 0,
    }
    tenant_stats = {t: {'requests': 0, 'errors': 0} for t in TENANTS}
    start_time = time.time()
    
    while running:
        try:
            # Simulate requests for each tenant
            for tenant in TENANTS:
                # Each tenant gets 1-3 requests per cycle
                for _ in range(random.randint(1, 3)):
                    ok, ctx = simulate_request(tenant)
                    
                    if ok:
                        stats['requests'] += 1
                        tenant_stats[tenant]['requests'] += 1
                        
                        if ctx['is_error']:
                            stats['errors'] += 1
                            tenant_stats[tenant]['errors'] += 1
                            print(f"❌ ERROR | {tenant:8} | {ctx['method']:4} {ctx['path']:20} | {ctx['status_code']} | trace={ctx['trace_id'][:8]}...")
                        else:
                            print(f"✅ OK    | {tenant:8} | {ctx['method']:4} {ctx['path']:20} | {ctx['status_code']} | {ctx['duration_ms']:3}ms")
                    else:
                        stats['failed_sends'] += 1
            
            # Stats every 30 seconds
            elapsed = int(time.time() - start_time)
            if elapsed > 0 and elapsed % 30 == 0:
                error_rate = (stats['errors'] / stats['requests'] * 100) if stats['requests'] > 0 else 0
                print(f"\n📊 Stats ({elapsed}s): {stats['requests']} requests, {stats['errors']} errors ({error_rate:.1f}%), {stats['failed_sends']} send failures")
                for t in TENANTS:
                    print(f"   {t}: {tenant_stats[t]['requests']} requests, {tenant_stats[t]['errors']} errors")
                print()
            
            time.sleep(2)  # Wait 2 seconds between cycles
            
        except KeyboardInterrupt:
            break
        except Exception as e:
            stats['failed_sends'] += 1
            print(f"❌ Send Error: {e}")
            time.sleep(5)
    
    print(f"\n📊 Final Stats:")
    print(f"   Total Requests: {stats['requests']}")
    print(f"   Total Errors: {stats['errors']} ({(stats['errors']/stats['requests']*100) if stats['requests'] > 0 else 0:.1f}%)")
    print(f"   Failed Sends: {stats['failed_sends']}")
    print(f"   Runtime: {int(time.time() - start_time)}s")
    print("\n✅ Generator stopped")

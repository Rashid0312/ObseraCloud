#!/usr/bin/env python3
"""
Tempo Trace Generator - Sends proper distributed traces to Tempo via OTLP
"""

import requests
import time
import random
import uuid
import struct
import json

TEMPO_OTLP_URL = "http://localhost:4318"

def generate_trace_id():
    """Generate a 16-byte trace ID as 32+hex string"""
    return uuid.uuid4().hex  # 32 hex chars = 16 bytes

def generate_span_id():
    """Generate an 8-byte span ID as 16 hex string"""
    return uuid.uuid4().hex[:16]  # 16 hex chars = 8 bytes

def create_span(trace_id, span_id, parent_span_id, service_name, operation_name, start_time_ns, duration_ms, status="OK", tenant_id="acme"):
    """Create a span in OTLP format"""
    end_time_ns = start_time_ns + (duration_ms * 1_000_000)
    
    status_code = 1 if status == "OK" else 2  # 1=OK, 2=ERROR
    
    return {
        "traceId": trace_id,
        "spanId": span_id,
        "parentSpanId": parent_span_id if parent_span_id else "",
        "name": operation_name,
        "kind": 2,  # SPAN_KIND_SERVER
        "startTimeUnixNano": str(start_time_ns),
        "endTimeUnixNano": str(end_time_ns),
        "attributes": [
            {"key": "service.name", "value": {"stringValue": service_name}},
            {"key": "tenant_id", "value": {"stringValue": tenant_id}},
            {"key": "http.method", "value": {"stringValue": random.choice(["GET", "POST", "PUT"])}},
            {"key": "http.url", "value": {"stringValue": f"/api/{random.choice(['users', 'orders', 'products'])}"}},
            {"key": "http.status_code", "value": {"intValue": 200 if status == "OK" else 500}}
        ],
        "status": {
            "code": status_code
        }
    }

def generate_distributed_trace(tenant_id="acme"):
    """Generate a multi-service distributed trace"""
    trace_id = generate_trace_id()
    
    # Root span - API Gateway
    root_span_id = generate_span_id()
    base_time = int(time.time() * 1_000_000_000)
    
    # Determine if this trace has an error
    has_error = random.random() < 0.15
    slow_service = random.choice(["auth-service", "order-service", "database"]) if random.random() < 0.2 else None
    
    # Create span hierarchy
    spans = []
    
    # 1. Root: API Gateway (total request)
    total_duration = random.randint(50, 200)
    if slow_service:
        total_duration = random.randint(500, 2000)
    
    root_span = create_span(
        trace_id, root_span_id, None,
        "api-gateway", "HTTP Request",
        base_time, total_duration,
        "ERROR" if has_error else "OK",
        tenant_id
    )
    spans.append(root_span)
    
    # 2. Child: Auth Service
    auth_span_id = generate_span_id()
    auth_duration = random.randint(100, 300) if slow_service == "auth-service" else random.randint(5, 30)
    auth_start = base_time + random.randint(1, 5) * 1_000_000
    
    spans.append(create_span(
        trace_id, auth_span_id, root_span_id,
        "auth-service", "Authenticate User",
        auth_start, auth_duration,
        "ERROR" if has_error and slow_service == "auth-service" else "OK",
        tenant_id
    ))
    
    # 3. Child: Order/Business Service
    order_span_id = generate_span_id()
    order_duration = random.randint(300, 800) if slow_service == "order-service" else random.randint(20, 80)
    order_start = auth_start + auth_duration * 1_000_000
    
    spans.append(create_span(
        trace_id, order_span_id, root_span_id,
        "order-service", "Process Order",
        order_start, order_duration,
        "ERROR" if has_error and slow_service == "order-service" else "OK",
        tenant_id
    ))
    
    # 4. Grandchild: Database Call
    db_span_id = generate_span_id()
    db_duration = random.randint(200, 600) if slow_service == "database" else random.randint(5, 25)
    db_start = order_start + random.randint(5, 15) * 1_000_000
    
    spans.append(create_span(
        trace_id, db_span_id, order_span_id,
        "database", "SELECT * FROM orders",
        db_start, db_duration,
        "ERROR" if has_error and slow_service == "database" else "OK",
        tenant_id
    ))
    
    return {
        "resourceSpans": [{
            "resource": {
                "attributes": [
                    {"key": "service.name", "value": {"stringValue": "skyview-demo"}},
                    {"key": "tenant_id", "value": {"stringValue": tenant_id}}
                ]
            },
            "scopeSpans": [{
                "scope": {"name": "skyview-tracer"},
                "spans": spans
            }]
        }]
    }

def send_trace_to_tempo(trace_data):
    """Send trace to Tempo via OTLP HTTP"""
    try:
        response = requests.post(
            f"{TEMPO_OTLP_URL}/v1/traces",
            json=trace_data,
            headers={"Content-Type": "application/json"},
            timeout=5
        )
        return response.status_code in [200, 202]
    except Exception as e:
        print(f"Error sending trace: {e}")
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("🔗 Tempo Trace Generator")
    print("=" * 60)
    print(f"📡 Sending to: {TEMPO_OTLP_URL}")
    print("⏹️  Press Ctrl+C to stop\n")
    
    tenants = ['acme', 'globex', 'initech']
    count = 0
    errors = 0
    
    try:
        while True:
            tenant = random.choice(tenants)
            trace_data = generate_distributed_trace(tenant)
            
            if send_trace_to_tempo(trace_data):
                count += 1
                trace_id = trace_data['resourceSpans'][0]['scopeSpans'][0]['spans'][0]['traceId'][:8]
                span_count = len(trace_data['resourceSpans'][0]['scopeSpans'][0]['spans'])
                print(f"🔗 TRACE | {tenant:8} | {trace_id}... | {span_count} spans")
            else:
                errors += 1
            
            time.sleep(3)  # Send a trace every 3 seconds
            
    except KeyboardInterrupt:
        print(f"\n\n📊 Stats: {count} traces sent, {errors} errors")
        print("✅ Generator stopped")

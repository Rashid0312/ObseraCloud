#!/usr/bin/env python3
"""
ClickHouse Test Generator - Sends OTLP traces to OTel Collector (port 4318)
"""

import requests
import time
import random
import uuid

# POINT TO OTEL COLLECTOR (Not Tempo directly)
OTEL_COLLECTOR_URL = "http://localhost:4318"

def generate_trace_id():
    return uuid.uuid4().hex

def generate_span_id():
    return uuid.uuid4().hex[:16]

def create_span(trace_id, span_id, parent_span_id, service_name, operation_name, start_time_ns, duration_ms, status="OK", tenant_id="acme"):
    end_time_ns = start_time_ns + (duration_ms * 1_000_000)
    status_code = 1 if status == "OK" else 2
    
    return {
        "traceId": trace_id,
        "spanId": span_id,
        "parentSpanId": parent_span_id if parent_span_id else "",
        "name": operation_name,
        "kind": 2, 
        "startTimeUnixNano": str(start_time_ns),
        "endTimeUnixNano": str(end_time_ns),
        "attributes": [
            {"key": "service.name", "value": {"stringValue": service_name}},
            {"key": "tenant_id", "value": {"stringValue": tenant_id}},
            {"key": "test_marker", "value": {"stringValue": "clickhouse_verification"}}
        ],
        "status": {"code": status_code}
    }

def generate_trace():
    trace_id = generate_trace_id()
    span_id = generate_span_id()
    start_time = int(time.time() * 1_000_000_000)
    
    span = create_span(trace_id, span_id, None, "test-service", "test-operation", start_time, 100)
    
    return {
        "resourceSpans": [{
            "resource": {
                "attributes": [
                    {"key": "service.name", "value": {"stringValue": "test-service"}},
                    {"key": "tenant_id", "value": {"stringValue": "acme"}}
                ]
            },
            "scopeSpans": [{
                "scope": {"name": "test-tracer"},
                "spans": [span]
            }]
        }]
    }

def send_trace():
    trace_data = generate_trace()
    try:
        response = requests.post(
            f"{OTEL_COLLECTOR_URL}/v1/traces",
            json=trace_data,
            headers={"Content-Type": "application/json"},
            timeout=5
        )
        if response.status_code in [200, 202]:
            print("✓ Sent trace to OTel Collector")
            return True
        else:
            print(f"✗ Failed: {response.status_code} {response.text}")
            return False
    except Exception as e:
        print(f"✗ Error: {e}")
        return False

if __name__ == "__main__":
    print(f"Sending 10 traces to {OTEL_COLLECTOR_URL}...")
    for i in range(10):
        send_trace()
        time.sleep(0.5)

#!/usr/bin/env python3
"""
ClickHouse Metrics Generator - Sends OTLP Metrics to OTel Collector (port 4318)
"""

import requests
import time
import random

OTEL_COLLECTOR_URL = "http://localhost:4318"

def generate_metric_payload(tenant_id="acme", metric_name="http_requests_total", value=1):
    timestamp_ns = str(int(time.time() * 1e9))
    
    return {
        "resourceMetrics": [{
            "resource": {
                "attributes": [
                    {"key": "service.name", "value": {"stringValue": "metrics-generator"}},
                    {"key": "tenant_id", "value": {"stringValue": tenant_id}}
                ]
            },
            "scopeMetrics": [{
                "scope": {"name": "metrics-test"},
                "metrics": [{
                    "name": metric_name,
                    "sum": {
                        "dataPoints": [{
                            "startTimeUnixNano": timestamp_ns,
                            "timeUnixNano": timestamp_ns,
                            "asInt": str(value),
                            "attributes": [
                                {"key": "method", "value": {"stringValue": "GET"}},
                                {"key": "status", "value": {"stringValue": "200"}}
                            ]
                        }],
                        "aggregationTemporality": 2, # Cumulative
                        "isMonotonic": True
                    }
                }]
            }]
        }]
    }

def send_metric():
    payload = generate_metric_payload()
    try:
        response = requests.post(
            f"{OTEL_COLLECTOR_URL}/v1/metrics",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=5
        )
        if response.status_code in [200, 202]:
            print("✓ Sent metric to OTel Collector")
            return True
        else:
            print(f"✗ Failed: {response.status_code} {response.text}")
            return False
    except Exception as e:
        print(f"✗ Error: {e}")
        return False

if __name__ == "__main__":
    print(f"Sending metrics to {OTEL_COLLECTOR_URL}...")
    for i in range(5):
        send_metric()
        time.sleep(0.5)

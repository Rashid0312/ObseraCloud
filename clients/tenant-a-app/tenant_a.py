import time
import logging
from random import randint
from opentelemetry import trace, metrics
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.sdk.resources import Resource
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
from opentelemetry.exporter.otlp.proto.grpc._log_exporter import OTLPLogExporter
from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry._logs import set_logger_provider

TENANT_ID = "tenant-a"
SERVICE_NAME = "tenant-a-app"
OTEL_COLLECTOR_ENDPOINT = "localhost:4317"

resource = Resource.create({
    "service.name": SERVICE_NAME,
    "tenant.id": TENANT_ID
})

trace_provider = TracerProvider(resource=resource)
trace_exporter = OTLPSpanExporter(endpoint=OTEL_COLLECTOR_ENDPOINT, insecure=True)
trace_provider.add_span_processor(BatchSpanProcessor(trace_exporter))
trace.set_tracer_provider(trace_provider)
tracer = trace.get_tracer(__name__)

metric_exporter = OTLPMetricExporter(endpoint=OTEL_COLLECTOR_ENDPOINT, insecure=True)
metric_reader = PeriodicExportingMetricReader(metric_exporter, export_interval_millis=10000)
meter_provider = MeterProvider(resource=resource, metric_readers=[metric_reader])
metrics.set_meter_provider(meter_provider)
meter = metrics.get_meter(__name__)

request_counter = meter.create_counter(
    name="tenant_a_requests_total",
    description="Total requests from Tenant A",
    unit="1"
)

response_time_histogram = meter.create_histogram(
    name="tenant_a_response_time",
    description="Response time for Tenant A requests",
    unit="ms"
)

logger_provider = LoggerProvider(resource=resource)
log_exporter = OTLPLogExporter(endpoint=OTEL_COLLECTOR_ENDPOINT, insecure=True)
logger_provider.add_log_record_processor(BatchLogRecordProcessor(log_exporter))
set_logger_provider(logger_provider)

logger = logging.getLogger(SERVICE_NAME)
logger.setLevel(logging.INFO)
handler = LoggingHandler(level=logging.INFO, logger_provider=logger_provider)
logger.addHandler(handler)

request_count = 0

def simulate_request():
    global request_count
    request_count += 1
    
    with tracer.start_as_current_span("handle_request") as span:
        span.set_attribute("tenant.id", TENANT_ID)
        span.set_attribute("http.method", "GET")
        span.set_attribute("http.route", "/api/data")
        
        response_time = randint(50, 300)
        time.sleep(response_time / 1000)
        
        request_counter.add(1, {"tenant_id": TENANT_ID, "endpoint": "/api/data"})
        response_time_histogram.record(response_time, {"tenant_id": TENANT_ID})
        
        logger.info(
            f"Processed request for {TENANT_ID}",
            extra={
                "tenant_id": TENANT_ID,
                "endpoint": "/api/data",
                "response_time_ms": response_time
            }
        )
        
        print(f"✓ Tenant A: Request #{request_count} | Response time: {response_time}ms")
        span.set_attribute("http.status_code", 200)

if __name__ == "__main__":
    print(f"Starting Tenant A traffic generator...")
    print(f"Sending telemetry to {OTEL_COLLECTOR_ENDPOINT}")
    print("Press Ctrl+C to stop\n")
    
    try:
        while True:
            simulate_request()
            time.sleep(2)
    except KeyboardInterrupt:
        print("\nShutting down gracefully...")
        trace_provider.shutdown()
        meter_provider.shutdown()
        logger_provider.shutdown()
        print("Shutdown complete.")

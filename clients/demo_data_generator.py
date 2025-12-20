import time
import random
from opentelemetry import trace, metrics
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry._logs import set_logger_provider
from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.exporter.otlp.proto.grpc._log_exporter import OTLPLogExporter
import logging

# Service configuration
SERVICE_NAME = "demo-app"
OTEL_COLLECTOR_ENDPOINT = "localhost:4317"

# Create resource with service name
resource = Resource(attributes={
    "service.name": SERVICE_NAME,
    "deployment.environment": "production"
})

# ============ TRACES SETUP ============
trace_provider = TracerProvider(resource=resource)
span_exporter = OTLPSpanExporter(endpoint=OTEL_COLLECTOR_ENDPOINT, insecure=True)
trace_provider.add_span_processor(BatchSpanProcessor(span_exporter))
trace.set_tracer_provider(trace_provider)
tracer = trace.get_tracer(__name__)

# ============ METRICS SETUP ============
metric_reader = PeriodicExportingMetricReader(
    OTLPMetricExporter(endpoint=OTEL_COLLECTOR_ENDPOINT, insecure=True)
)
meter_provider = MeterProvider(resource=resource, metric_readers=[metric_reader])
metrics.set_meter_provider(meter_provider)
meter = metrics.get_meter(__name__)

# Create metrics
request_counter = meter.create_counter(
    name="http_requests_total",
    description="Total HTTP requests",
    unit="1"
)

response_time_histogram = meter.create_histogram(
    name="http_request_duration_seconds",
    description="HTTP request latency",
    unit="s"
)

# ============ LOGS SETUP ============
logger_provider = LoggerProvider(resource=resource)
log_exporter = OTLPLogExporter(endpoint=OTEL_COLLECTOR_ENDPOINT, insecure=True)
logger_provider.add_log_record_processor(BatchLogRecordProcessor(log_exporter))
set_logger_provider(logger_provider)

# Configure Python logging
handler = LoggingHandler(level=logging.NOTSET, logger_provider=logger_provider)
logging.getLogger().addHandler(handler)
logging.getLogger().setLevel(logging.INFO)

# ============ DEMO DATA GENERATION ============
def generate_telemetry():
    """Generate realistic telemetry data"""
    endpoints = ["/api/users", "/api/products", "/api/orders", "/api/checkout", "/health"]
    log_messages = [
        ("INFO", "Processing user request"),
        ("INFO", "Database query completed successfully"),
        ("INFO", "Cache hit for product data"),
        ("WARNING", "High memory usage detected"),
        ("WARNING", "Slow query detected: 850ms"),
        ("ERROR", "Database connection timeout"),
        ("ERROR", "Payment gateway returned 500"),
        ("ERROR", "Failed to validate user input"),
    ]
    
    iteration = 0
    
    while True:
        iteration += 1
        endpoint = random.choice(endpoints)
        status_code = random.choices([200, 201, 400, 404, 500], weights=[70, 10, 10, 5, 5])[0]
        duration = random.uniform(0.05, 2.0)
        
        # Create a trace with multiple spans
        with tracer.start_as_current_span(f"HTTP {endpoint}") as span:
            span.set_attribute("http.method", "GET")
            span.set_attribute("http.url", endpoint)
            span.set_attribute("http.status_code", status_code)
            span.set_attribute("iteration", iteration)
            
            # Simulate database call span
            with tracer.start_as_current_span("database.query"):
                time.sleep(random.uniform(0.01, 0.1))
            
            # Simulate external API call span (occasionally)
            if random.random() > 0.7:
                with tracer.start_as_current_span("external.api.call"):
                    time.sleep(random.uniform(0.05, 0.2))
            
            # Record metrics
            request_counter.add(1, {
                "endpoint": endpoint,
                "status": str(status_code),
                "method": "GET"
            })
            
            response_time_histogram.record(duration, {
                "endpoint": endpoint,
                "status": str(status_code)
            })
            
            # Generate structured logs
            log_level, log_message = random.choice(log_messages)
            
            if log_level == "INFO":
                logging.info(log_message, extra={
                    "endpoint": endpoint,
                    "status_code": status_code,
                    "duration_ms": round(duration * 1000, 2),
                    "iteration": iteration
                })
            elif log_level == "WARNING":
                logging.warning(log_message, extra={
                    "endpoint": endpoint,
                    "status_code": status_code,
                    "duration_ms": round(duration * 1000, 2),
                    "iteration": iteration
                })
            elif log_level == "ERROR":
                logging.error(log_message, extra={
                    "endpoint": endpoint,
                    "status_code": status_code,
                    "duration_ms": round(duration * 1000, 2),
                    "iteration": iteration
                })
        
        # Sleep between requests (faster for more data)
        time.sleep(random.uniform(0.5, 2.0))
        
        # Print status every 10 iterations
        if iteration % 10 == 0:
            print(f"✅ Generated {iteration} telemetry events (traces, metrics, logs)")

if __name__ == "__main__":
    print("🚀 Starting Demo Data Generator...")
    print(f"📊 Service: {SERVICE_NAME}")
    print(f"🔗 OTel Collector: {OTEL_COLLECTOR_ENDPOINT}")
    print("=" * 60)
    
    try:
        generate_telemetry()
    except KeyboardInterrupt:
        print("\n⏹️  Demo generator stopped")

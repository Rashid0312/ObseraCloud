# ObseraCloud Integration Guide for Tourni1010

To ensure **all errors** and logs are captured in ObseraCloud, please follow this configuration guide.

## 1. Required Configuration
Ensure these environment variables are set in your application deployment:

```bash
# Point to the ObseraCloud Auth Gateway
export OTEL_EXPORTER_OTLP_ENDPOINT="http://46.62.229.59:4319"
export OTEL_EXPORTER_OTLP_PROTOCOL="http/protobuf"

# CRITICAL: Identify your service and tenant
export OTEL_RESOURCE_ATTRIBUTES="service.name=tourni-app,tenant_id=Tourni1010,deployment.environment=production"

# specific header for authentication
export OTEL_EXPORTER_OTLP_HEADERS="X-API-Key=TIZmGdT-VDtRe60pckQTX5_NuMes9OhcMDyaOJhh0wA"
```

## 2. Python (Flask/Django/FastAPI)

Installing the OTel Logging Handler is required to bridge standard Python `logging` to SkyView.

### Requirements
```txt
opentelemetry-api
opentelemetry-sdk
opentelemetry-exporter-otlp
opentelemetry-instrumentation-logging
```

### Setup Code (Main Entry Point)
```python
import logging
from opentelemetry import trace
from opentelemetry._logs import set_logger_provider
from opentelemetry.exporter.otlp.proto.http._log_exporter import OTLPLogExporter
from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.sdk.resources import Resource

# 1. Setup Logging Provider
resource = Resource.create({
    "service.name": "tourni-app", 
    "tenant_id": "Tourni1010"
})
logger_provider = LoggerProvider(resource=resource)
set_logger_provider(logger_provider)

# 2. Configure OTLP Exporter (sends to SkyView)
exporter = OTLPLogExporter(endpoint="http://46.62.229.59:4319/v1/logs")
logger_provider.add_log_record_processor(BatchLogRecordProcessor(exporter))

# 3. Attach Handler to Root Logger (Captures ALL logs)
handler = LoggingHandler(level=logging.INFO, logger_provider=logger_provider)
logging.getLogger().addHandler(handler)

# 4. Global Exception Handler (Captures unhandled crashes)
def handle_exception(exc_type, exc_value, exc_traceback):
    logging.error("Unhandled Exception", exc_info=(exc_type, exc_value, exc_traceback))

import sys
sys.excepthook = handle_exception
```

## 3. Node.js (Express/NestJS)

### Requirements
```bash
npm install @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node
```

### Setup Code
```javascript
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-proto');
const { OTLPLogExporter } = require('@opentelemetry/exporter-logs-otlp-proto');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');

// Configure Exporters
const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'tourni-app',
    'tenant_id': 'Tourni1010', // CRITICAL
  }),
  traceExporter: new OTLPTraceExporter({
    url: 'http://46.62.229.59:4319/v1/traces',
    headers: { 'X-API-Key': 'TIZmGdT-VDtRe60pckQTX5_NuMes9OhcMDyaOJhh0wA' }
  }),
  logExporter: new OTLPLogExporter({
    url: 'http://46.62.229.59:4319/v1/logs',
    headers: { 'X-API-Key': 'TIZmGdT-VDtRe60pckQTX5_NuMes9OhcMDyaOJhh0wA' }
  }),
});

sdk.start();

// Validating Error Capture
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  // Ensure the error is logged before exit
});
```
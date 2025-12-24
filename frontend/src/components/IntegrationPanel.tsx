import React, { useState } from 'react';
import { Key, Copy, Check, Terminal, Code, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react';
import './IntegrationPanel.css';

interface IntegrationPanelProps {
    apiKey: string;
    tenantId: string;
}

const IntegrationPanel: React.FC<IntegrationPanelProps> = ({ apiKey, tenantId }) => {
    const [copied, setCopied] = useState<string | null>(null);
    const [expandedSection, setExpandedSection] = useState<string>('quickstart');

    const otlpEndpoint = window.location.hostname === 'localhost'
        ? 'http://localhost:4319'
        : `https://${window.location.hostname}:4319`;

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopied(id);
        setTimeout(() => setCopied(null), 2000);
    };

    const pythonCode = `from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter

# Configure exporter with your API key
exporter = OTLPSpanExporter(
    endpoint="${otlpEndpoint}/v1/traces",
    headers={"X-API-Key": "${apiKey}"}
)

# Setup tracer
provider = TracerProvider()
provider.add_span_processor(BatchSpanProcessor(exporter))
trace.set_tracer_provider(provider)

# Create traces
tracer = trace.get_tracer("my-service")
with tracer.start_as_current_span("my-operation"):
    # Your code here
    pass`;

    const jsCode = `import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

const exporter = new OTLPTraceExporter({
  url: '${otlpEndpoint}/v1/traces',
  headers: { 'X-API-Key': '${apiKey}' }
});

const sdk = new NodeSDK({
  traceExporter: exporter,
  serviceName: 'my-node-service'
});

sdk.start();`;

    const curlCode = `curl -X POST ${otlpEndpoint}/v1/traces \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${apiKey}" \\
  -d '{
    "resourceSpans": [{
      "resource": {
        "attributes": [{"key": "service.name", "value": {"stringValue": "my-service"}}]
      },
      "scopeSpans": [{
        "scope": {"name": "my-tracer"},
        "spans": [{
          "traceId": "...",
          "spanId": "...",
          "name": "my-operation",
          "startTimeUnixNano": "...",
          "endTimeUnixNano": "...",
          "status": {"code": 1}
        }]
      }]
    }]
  }'`;

    const toggleSection = (section: string) => {
        setExpandedSection(expandedSection === section ? '' : section);
    };

    return (
        <div className="integration-panel">
            <div className="integration-header">
                <h2><Key size={20} /> Integration Guide</h2>
                <p>Connect your application to ObseraCloud</p>
            </div>

            {/* API Key Section */}
            <div className="integration-section api-key-section">
                <div className="section-title">
                    <Key size={16} />
                    <span>Your API Key</span>
                </div>
                <div className="api-key-box">
                    <code className="api-key-value">{apiKey}</code>
                    <button
                        className="copy-btn"
                        onClick={() => copyToClipboard(apiKey, 'apikey')}
                        title="Copy API Key"
                    >
                        {copied === 'apikey' ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                </div>
                <p className="api-key-hint">Keep this key secret! Use environment variables in production.</p>
            </div>

            {/* Endpoint Section */}
            <div className="integration-section">
                <div className="section-title">
                    <ExternalLink size={16} />
                    <span>OTLP Endpoint</span>
                </div>
                <div className="endpoint-box">
                    <code>{otlpEndpoint}/v1/traces</code>
                    <button
                        className="copy-btn"
                        onClick={() => copyToClipboard(`${otlpEndpoint}/v1/traces`, 'endpoint')}
                    >
                        {copied === 'endpoint' ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                </div>
            </div>

            {/* Code Examples */}
            <div className="integration-section code-examples">
                <div className="section-title">
                    <Code size={16} />
                    <span>Quick Start</span>
                </div>

                {/* Python */}
                <div className="code-block">
                    <div
                        className="code-header"
                        onClick={() => toggleSection('python')}
                    >
                        {expandedSection === 'python' ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <span className="lang-badge python">Python</span>
                        <span>OpenTelemetry SDK</span>
                        <button
                            className="copy-btn small"
                            onClick={(e) => { e.stopPropagation(); copyToClipboard(pythonCode, 'python'); }}
                        >
                            {copied === 'python' ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                    </div>
                    {expandedSection === 'python' && (
                        <pre className="code-content"><code>{pythonCode}</code></pre>
                    )}
                </div>

                {/* JavaScript */}
                <div className="code-block">
                    <div
                        className="code-header"
                        onClick={() => toggleSection('javascript')}
                    >
                        {expandedSection === 'javascript' ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <span className="lang-badge javascript">JavaScript</span>
                        <span>Node.js SDK</span>
                        <button
                            className="copy-btn small"
                            onClick={(e) => { e.stopPropagation(); copyToClipboard(jsCode, 'javascript'); }}
                        >
                            {copied === 'javascript' ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                    </div>
                    {expandedSection === 'javascript' && (
                        <pre className="code-content"><code>{jsCode}</code></pre>
                    )}
                </div>

                {/* cURL */}
                <div className="code-block">
                    <div
                        className="code-header"
                        onClick={() => toggleSection('curl')}
                    >
                        {expandedSection === 'curl' ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <span className="lang-badge curl">cURL</span>
                        <span>Direct HTTP</span>
                        <button
                            className="copy-btn small"
                            onClick={(e) => { e.stopPropagation(); copyToClipboard(curlCode, 'curl'); }}
                        >
                            {copied === 'curl' ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                    </div>
                    {expandedSection === 'curl' && (
                        <pre className="code-content"><code>{curlCode}</code></pre>
                    )}
                </div>
            </div>

            {/* Support Section */}
            <div className="integration-section support-section">
                <Terminal size={16} />
                <div>
                    <strong>Need help?</strong>
                    <p>Check the documentation or contact support for assistance.</p>
                </div>
            </div>
        </div>
    );
};

export default IntegrationPanel;

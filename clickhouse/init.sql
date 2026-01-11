-- ClickHouse Schema for OpenTelemetry
-- Based on standard OTel exporters

-- ==========================================
-- LOGS
-- ==========================================
CREATE TABLE IF NOT EXISTS otel_logs (
    Timestamp DateTime64(9) CODEC(Delta, ZSTD(1)),
    TraceId String CODEC(ZSTD(1)),
    SpanId String CODEC(ZSTD(1)),
    TraceFlags UInt32 CODEC(ZSTD(1)),
    SeverityText LowCardinality(String) CODEC(ZSTD(1)),
    SeverityNumber Int32 CODEC(ZSTD(1)),
    ServiceName LowCardinality(String) CODEC(ZSTD(1)),
    Body String CODEC(ZSTD(1)),
    ResourceSchemaUrl String CODEC(ZSTD(1)),
    ResourceAttributes Map(String, String) CODEC(ZSTD(1)),
    ScopeSchemaUrl String CODEC(ZSTD(1)),
    ScopeName String CODEC(ZSTD(1)),
    ScopeVersion String CODEC(ZSTD(1)),
    ScopeAttributes Map(String, String) CODEC(ZSTD(1)),
    LogAttributes Map(String, String) CODEC(ZSTD(1))
) ENGINE = MergeTree()
PARTITION BY toDate(Timestamp)
ORDER BY (ServiceName, SeverityText, Timestamp)
TTL toDateTime(Timestamp) + INTERVAL 30 DAY;

-- ==========================================
-- TRACES
-- ==========================================
CREATE TABLE IF NOT EXISTS otel_traces (
    Timestamp DateTime64(9) CODEC(Delta, ZSTD(1)),
    TraceId String CODEC(ZSTD(1)),
    SpanId String CODEC(ZSTD(1)),
    ParentSpanId String CODEC(ZSTD(1)),
    TraceState String CODEC(ZSTD(1)),
    SpanName LowCardinality(String) CODEC(ZSTD(1)),
    SpanKind LowCardinality(String) CODEC(ZSTD(1)),
    ServiceName LowCardinality(String) CODEC(ZSTD(1)),
    ResourceAttributes Map(String, String) CODEC(ZSTD(1)),
    ScopeName String CODEC(ZSTD(1)),
    ScopeVersion String CODEC(ZSTD(1)),
    SpanAttributes Map(String, String) CODEC(ZSTD(1)),
    Duration Int64 CODEC(ZSTD(1)),
    StatusCode LowCardinality(String) CODEC(ZSTD(1)),
    StatusMessage String CODEC(ZSTD(1)),
    Events Nested(
        Timestamp DateTime64(9),
        Name LowCardinality(String),
        Attributes Map(String, String)
    ) CODEC(ZSTD(1)),
    Links Nested(
        TraceId String,
        SpanId String,
        TraceState String,
        Attributes Map(String, String)
    ) CODEC(ZSTD(1))
) ENGINE = MergeTree()
PARTITION BY toDate(Timestamp)
ORDER BY (ServiceName, SpanName, Timestamp)
TTL toDateTime(Timestamp) + INTERVAL 30 DAY;

-- Trace ID lookup table (Index)
CREATE TABLE IF NOT EXISTS otel_traces_trace_id_ts (
     TraceId String CODEC(ZSTD(1)),
     Start DateTime64(9) CODEC(Delta, ZSTD(1)),
     End DateTime64(9) CODEC(Delta, ZSTD(1))
) ENGINE = MergeTree()
ORDER BY (TraceId, Start);

-- Materialized View to populate trace ID lookup
CREATE MATERIALIZED VIEW IF NOT EXISTS otel_traces_trace_id_ts_mv TO otel_traces_trace_id_ts AS
SELECT
    TraceId,
    min(Timestamp) as Start,
    max(Timestamp) as End
FROM otel_traces
GROUP BY TraceId;

-- ==========================================
-- METRICS (Simplified Schema)
-- ==========================================
CREATE TABLE IF NOT EXISTS otel_metrics_gauge (
    Timestamp DateTime64(9) CODEC(Delta, ZSTD(1)),
    MetricName LowCardinality(String) CODEC(ZSTD(1)),
    ServiceName LowCardinality(String) CODEC(ZSTD(1)),
    ResourceAttributes Map(String, String) CODEC(ZSTD(1)), -- Added
    Attributes Map(String, String) CODEC(ZSTD(1)),
    ResourceSchemaUrl String CODEC(ZSTD(1)), -- Added for OTel 1.x compatibility
    ScopeName String CODEC(ZSTD(1)), -- Added for OTel 1.x compatibility
    ScopeVersion String CODEC(ZSTD(1)), -- Added for OTel 1.x compatibility
    ScopeAttributes Map(String, String) CODEC(ZSTD(1)), -- Added for OTel 1.x compatibility
    ScopeSchemaUrl String CODEC(ZSTD(1)), -- Added for OTel 1.x compatibility
    ScopeDroppedAttrCount UInt32 DEFAULT 0 CODEC(ZSTD(1)), -- Added for OTel 1.x compatibility
    MetricDescription String DEFAULT '' CODEC(ZSTD(1)), -- Added for OTel 1.x compatibility
    MetricUnit String DEFAULT '' CODEC(ZSTD(1)), -- Added for OTel 1.x compatibility
    StartTimeUnix DateTime64(9) CODEC(Delta, ZSTD(1)), -- Added for OTel 1.x compatibility
    TimeUnix DateTime64(9) CODEC(Delta, ZSTD(1)), -- Added for OTel 1.x compatibility
    Flags UInt32 DEFAULT 0 CODEC(ZSTD(1)), -- Added for OTel 1.x compatibility
    -- Exemplars Removed to reduce complexity/memory
    Value Float64 CODEC(ZSTD(1)),
    IsMonotonic Boolean CODEC(ZSTD(1)),
    AggregationTemporality Int32 CODEC(ZSTD(1)),
    Count UInt64 CODEC(ZSTD(1)),
    Sum Float64 CODEC(ZSTD(1)),
    Min Float64 CODEC(ZSTD(1)),
    Max Float64 CODEC(ZSTD(1))
) ENGINE = MergeTree()
PARTITION BY toDate(Timestamp)
ORDER BY (ServiceName, MetricName, Timestamp)
TTL toDateTime(Timestamp) + INTERVAL 30 DAY;

CREATE TABLE IF NOT EXISTS otel_metrics_sum (
    Timestamp DateTime64(9) CODEC(Delta, ZSTD(1)),
    MetricName LowCardinality(String) CODEC(ZSTD(1)),
    ServiceName LowCardinality(String) CODEC(ZSTD(1)),
    ResourceAttributes Map(String, String) CODEC(ZSTD(1)), -- Added
    Attributes Map(String, String) CODEC(ZSTD(1)),
    ResourceSchemaUrl String CODEC(ZSTD(1)), -- Added for OTel 1.x compatibility
    ScopeName String CODEC(ZSTD(1)), -- Added for OTel 1.x compatibility
    ScopeVersion String CODEC(ZSTD(1)), -- Added for OTel 1.x compatibility
    ScopeAttributes Map(String, String) CODEC(ZSTD(1)), -- Added for OTel 1.x compatibility
    ScopeSchemaUrl String CODEC(ZSTD(1)), -- Added for OTel 1.x compatibility
    ScopeDroppedAttrCount UInt32 DEFAULT 0 CODEC(ZSTD(1)), -- Added for OTel 1.x compatibility
    MetricDescription String DEFAULT '' CODEC(ZSTD(1)), -- Added for OTel 1.x compatibility
    MetricUnit String DEFAULT '' CODEC(ZSTD(1)), -- Added for OTel 1.x compatibility
    StartTimeUnix DateTime64(9) CODEC(Delta, ZSTD(1)), -- Added for OTel 1.x compatibility
    TimeUnix DateTime64(9) CODEC(Delta, ZSTD(1)), -- Added for OTel 1.x compatibility
    Flags UInt32 DEFAULT 0 CODEC(ZSTD(1)), -- Added for OTel 1.x compatibility
    Exemplars Nested(
        FilteredAttributes Map(String, String),
        TimeUnix DateTime64(9),
        Value Float64,
        SpanId String,
        TraceId String
    ) CODEC(ZSTD(1)), -- Added for OTel 1.x compatibility
    Value Float64 CODEC(ZSTD(1)),
    IsMonotonic Boolean CODEC(ZSTD(1)),
    AggregationTemporality Int32 CODEC(ZSTD(1)) -- Changed to Int32
) ENGINE = MergeTree()
PARTITION BY toDate(Timestamp)
ORDER BY (ServiceName, MetricName, Timestamp)
TTL toDateTime(Timestamp) + INTERVAL 30 DAY;

CREATE TABLE IF NOT EXISTS otel_metrics_histogram (
    Timestamp DateTime64(9) CODEC(Delta, ZSTD(1)),
    MetricName LowCardinality(String) CODEC(ZSTD(1)),
    ServiceName LowCardinality(String) CODEC(ZSTD(1)),
    ResourceAttributes Map(String, String) CODEC(ZSTD(1)), -- Added
    Attributes Map(String, String) CODEC(ZSTD(1)),
    ResourceSchemaUrl String CODEC(ZSTD(1)), -- Added for OTel 1.x compatibility
    ScopeName String CODEC(ZSTD(1)), -- Added for OTel 1.x compatibility
    ScopeVersion String CODEC(ZSTD(1)), -- Added for OTel 1.x compatibility
    ScopeAttributes Map(String, String) CODEC(ZSTD(1)), -- Added for OTel 1.x compatibility
    ScopeSchemaUrl String CODEC(ZSTD(1)), -- Added for OTel 1.x compatibility
    ScopeDroppedAttrCount UInt32 DEFAULT 0 CODEC(ZSTD(1)), -- Added for OTel 1.x compatibility
    MetricDescription String DEFAULT '' CODEC(ZSTD(1)), -- Added for OTel 1.x compatibility
    MetricUnit String DEFAULT '' CODEC(ZSTD(1)), -- Added for OTel 1.x compatibility
    StartTimeUnix DateTime64(9) CODEC(Delta, ZSTD(1)), -- Added for OTel 1.x compatibility
    TimeUnix DateTime64(9) CODEC(Delta, ZSTD(1)), -- Added for OTel 1.x compatibility
    Flags UInt32 DEFAULT 0 CODEC(ZSTD(1)), -- Added for OTel 1.x compatibility
    Exemplars Nested(
        FilteredAttributes Map(String, String),
        TimeUnix DateTime64(9),
        Value Float64,
        SpanId String,
        TraceId String
    ) CODEC(ZSTD(1)), -- Added for OTel 1.x compatibility
    Count UInt64 CODEC(ZSTD(1)),
    Sum Float64 CODEC(ZSTD(1)),
    BucketCounts Array(UInt64) CODEC(ZSTD(1)),
    ExplicitBounds Array(Float64) CODEC(ZSTD(1)),
    AggregationTemporality Int32 CODEC(ZSTD(1)), -- Changed to Int32
    Min Float64 CODEC(ZSTD(1)), -- Added
    Max Float64 CODEC(ZSTD(1))  -- Added
) ENGINE = MergeTree()
PARTITION BY toDate(Timestamp)
ORDER BY (ServiceName, MetricName, Timestamp)
TTL toDateTime(Timestamp) + INTERVAL 30 DAY;

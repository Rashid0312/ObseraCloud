
CREATE TABLE IF NOT EXISTS otel_metrics_gauge (
    Timestamp DateTime64(9) CODEC(Delta, ZSTD(1)),
    MetricName LowCardinality(String) CODEC(ZSTD(1)),
    ServiceName LowCardinality(String) CODEC(ZSTD(1)),
    ResourceAttributes Map(String, String) CODEC(ZSTD(1)),
    Attributes Map(String, String) CODEC(ZSTD(1)),
    ResourceSchemaUrl String CODEC(ZSTD(1)),
    ScopeName String CODEC(ZSTD(1)),
    ScopeVersion String CODEC(ZSTD(1)),
    ScopeAttributes Map(String, String) CODEC(ZSTD(1)),
    ScopeSchemaUrl String CODEC(ZSTD(1)),
    ScopeDroppedAttrCount UInt32 DEFAULT 0 CODEC(ZSTD(1)),
    MetricDescription String DEFAULT '' CODEC(ZSTD(1)),
    MetricUnit String DEFAULT '' CODEC(ZSTD(1)),
    StartTimeUnix DateTime64(9) CODEC(Delta, ZSTD(1)),
    TimeUnix DateTime64(9) CODEC(Delta, ZSTD(1)),
    Flags UInt32 DEFAULT 0 CODEC(ZSTD(1)),
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

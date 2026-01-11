
-- Patch to add Flags and Exemplars columns to metrics tables
ALTER TABLE otel_metrics_sum ADD COLUMN IF NOT EXISTS Flags UInt32 DEFAULT 0 CODEC(ZSTD(1));
ALTER TABLE otel_metrics_sum ADD COLUMN IF NOT EXISTS Exemplars Nested(
    FilteredAttributes Map(String, String),
    TimeUnix DateTime64(9),
    Value Float64,
    SpanId String,
    TraceId String
) CODEC(ZSTD(1));

ALTER TABLE otel_metrics_gauge ADD COLUMN IF NOT EXISTS Flags UInt32 DEFAULT 0 CODEC(ZSTD(1));
ALTER TABLE otel_metrics_gauge ADD COLUMN IF NOT EXISTS Exemplars Nested(
    FilteredAttributes Map(String, String),
    TimeUnix DateTime64(9),
    Value Float64,
    SpanId String,
    TraceId String
) CODEC(ZSTD(1));

ALTER TABLE otel_metrics_histogram ADD COLUMN IF NOT EXISTS Flags UInt32 DEFAULT 0 CODEC(ZSTD(1));
ALTER TABLE otel_metrics_histogram ADD COLUMN IF NOT EXISTS Exemplars Nested(
    FilteredAttributes Map(String, String),
    TimeUnix DateTime64(9),
    Value Float64,
    SpanId String,
    TraceId String
) CODEC(ZSTD(1));

ALTER TABLE otel_metrics_exponential_histogram ADD COLUMN IF NOT EXISTS Flags UInt32 DEFAULT 0 CODEC(ZSTD(1));
ALTER TABLE otel_metrics_exponential_histogram ADD COLUMN IF NOT EXISTS Exemplars Nested(
    FilteredAttributes Map(String, String),
    TimeUnix DateTime64(9),
    Value Float64,
    SpanId String,
    TraceId String
) CODEC(ZSTD(1));

ALTER TABLE otel_metrics_summary ADD COLUMN IF NOT EXISTS Flags UInt32 DEFAULT 0 CODEC(ZSTD(1));
-- Summary doesn't support Exemplars typically, but leaving it out or added if consistent. 
-- Usually Summary has QuantileValues. I'll omit Exemplars for Summary unless error asks.

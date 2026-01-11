
-- Patch to make otel_metrics_gauge a Super Table
-- Add Sum columns
ALTER TABLE otel_metrics_gauge ADD COLUMN IF NOT EXISTS IsMonotonic Boolean CODEC(ZSTD(1));
ALTER TABLE otel_metrics_gauge ADD COLUMN IF NOT EXISTS AggregationTemporality Int32 CODEC(ZSTD(1));

-- Add Histogram columns
ALTER TABLE otel_metrics_gauge ADD COLUMN IF NOT EXISTS Count UInt64 CODEC(ZSTD(1));
ALTER TABLE otel_metrics_gauge ADD COLUMN IF NOT EXISTS Sum Float64 CODEC(ZSTD(1));
ALTER TABLE otel_metrics_gauge ADD COLUMN IF NOT EXISTS BucketCounts Array(UInt64) CODEC(ZSTD(1));
ALTER TABLE otel_metrics_gauge ADD COLUMN IF NOT EXISTS ExplicitBounds Array(Float64) CODEC(ZSTD(1));
ALTER TABLE otel_metrics_gauge ADD COLUMN IF NOT EXISTS Min Float64 CODEC(ZSTD(1));
ALTER TABLE otel_metrics_gauge ADD COLUMN IF NOT EXISTS Max Float64 CODEC(ZSTD(1));


-- Patch to fix AggregationTemporality type and add Min/Max columns
ALTER TABLE otel_metrics_sum MODIFY COLUMN AggregationTemporality Int32 CODEC(ZSTD(1));
ALTER TABLE otel_metrics_histogram MODIFY COLUMN AggregationTemporality Int32 CODEC(ZSTD(1));

ALTER TABLE otel_metrics_histogram ADD COLUMN IF NOT EXISTS Min Float64 CODEC(ZSTD(1));
ALTER TABLE otel_metrics_histogram ADD COLUMN IF NOT EXISTS Max Float64 CODEC(ZSTD(1));
ALTER TABLE otel_metrics_exponential_histogram ADD COLUMN IF NOT EXISTS Min Float64 CODEC(ZSTD(1));
ALTER TABLE otel_metrics_exponential_histogram ADD COLUMN IF NOT EXISTS Max Float64 CODEC(ZSTD(1));
-- Exponential Histogram also has Min/Max usually.

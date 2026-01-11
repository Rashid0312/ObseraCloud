
-- Patch to add TimeUnix column to metrics tables
ALTER TABLE otel_metrics_sum ADD COLUMN IF NOT EXISTS TimeUnix DateTime64(9) CODEC(Delta, ZSTD(1));
ALTER TABLE otel_metrics_gauge ADD COLUMN IF NOT EXISTS TimeUnix DateTime64(9) CODEC(Delta, ZSTD(1));
ALTER TABLE otel_metrics_histogram ADD COLUMN IF NOT EXISTS TimeUnix DateTime64(9) CODEC(Delta, ZSTD(1));
ALTER TABLE otel_metrics_exponential_histogram ADD COLUMN IF NOT EXISTS TimeUnix DateTime64(9) CODEC(Delta, ZSTD(1));
ALTER TABLE otel_metrics_summary ADD COLUMN IF NOT EXISTS TimeUnix DateTime64(9) CODEC(Delta, ZSTD(1));


-- Patch to add MetricDescription and MetricUnit columns to metrics tables
ALTER TABLE otel_metrics_sum ADD COLUMN IF NOT EXISTS MetricDescription String DEFAULT '' CODEC(ZSTD(1));
ALTER TABLE otel_metrics_sum ADD COLUMN IF NOT EXISTS MetricUnit String DEFAULT '' CODEC(ZSTD(1));

ALTER TABLE otel_metrics_gauge ADD COLUMN IF NOT EXISTS MetricDescription String DEFAULT '' CODEC(ZSTD(1));
ALTER TABLE otel_metrics_gauge ADD COLUMN IF NOT EXISTS MetricUnit String DEFAULT '' CODEC(ZSTD(1));

ALTER TABLE otel_metrics_histogram ADD COLUMN IF NOT EXISTS MetricDescription String DEFAULT '' CODEC(ZSTD(1));
ALTER TABLE otel_metrics_histogram ADD COLUMN IF NOT EXISTS MetricUnit String DEFAULT '' CODEC(ZSTD(1));

ALTER TABLE otel_metrics_exponential_histogram ADD COLUMN IF NOT EXISTS MetricDescription String DEFAULT '' CODEC(ZSTD(1));
ALTER TABLE otel_metrics_exponential_histogram ADD COLUMN IF NOT EXISTS MetricUnit String DEFAULT '' CODEC(ZSTD(1));

ALTER TABLE otel_metrics_summary ADD COLUMN IF NOT EXISTS MetricDescription String DEFAULT '' CODEC(ZSTD(1));
ALTER TABLE otel_metrics_summary ADD COLUMN IF NOT EXISTS MetricUnit String DEFAULT '' CODEC(ZSTD(1));

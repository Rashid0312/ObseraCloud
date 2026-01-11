
-- Patch to add Scope columns to metrics tables
ALTER TABLE otel_metrics_sum ADD COLUMN IF NOT EXISTS ScopeName String CODEC(ZSTD(1));
ALTER TABLE otel_metrics_sum ADD COLUMN IF NOT EXISTS ScopeVersion String CODEC(ZSTD(1));
ALTER TABLE otel_metrics_sum ADD COLUMN IF NOT EXISTS ScopeAttributes Map(String, String) CODEC(ZSTD(1));
ALTER TABLE otel_metrics_sum ADD COLUMN IF NOT EXISTS ScopeSchemaUrl String CODEC(ZSTD(1));

ALTER TABLE otel_metrics_gauge ADD COLUMN IF NOT EXISTS ScopeName String CODEC(ZSTD(1));
ALTER TABLE otel_metrics_gauge ADD COLUMN IF NOT EXISTS ScopeVersion String CODEC(ZSTD(1));
ALTER TABLE otel_metrics_gauge ADD COLUMN IF NOT EXISTS ScopeAttributes Map(String, String) CODEC(ZSTD(1));
ALTER TABLE otel_metrics_gauge ADD COLUMN IF NOT EXISTS ScopeSchemaUrl String CODEC(ZSTD(1));

ALTER TABLE otel_metrics_histogram ADD COLUMN IF NOT EXISTS ScopeName String CODEC(ZSTD(1));
ALTER TABLE otel_metrics_histogram ADD COLUMN IF NOT EXISTS ScopeVersion String CODEC(ZSTD(1));
ALTER TABLE otel_metrics_histogram ADD COLUMN IF NOT EXISTS ScopeAttributes Map(String, String) CODEC(ZSTD(1));
ALTER TABLE otel_metrics_histogram ADD COLUMN IF NOT EXISTS ScopeSchemaUrl String CODEC(ZSTD(1));

ALTER TABLE otel_metrics_exponential_histogram ADD COLUMN IF NOT EXISTS ScopeName String CODEC(ZSTD(1));
ALTER TABLE otel_metrics_exponential_histogram ADD COLUMN IF NOT EXISTS ScopeVersion String CODEC(ZSTD(1));
ALTER TABLE otel_metrics_exponential_histogram ADD COLUMN IF NOT EXISTS ScopeAttributes Map(String, String) CODEC(ZSTD(1));
ALTER TABLE otel_metrics_exponential_histogram ADD COLUMN IF NOT EXISTS ScopeSchemaUrl String CODEC(ZSTD(1));

ALTER TABLE otel_metrics_summary ADD COLUMN IF NOT EXISTS ScopeName String CODEC(ZSTD(1));
ALTER TABLE otel_metrics_summary ADD COLUMN IF NOT EXISTS ScopeVersion String CODEC(ZSTD(1));
ALTER TABLE otel_metrics_summary ADD COLUMN IF NOT EXISTS ScopeAttributes Map(String, String) CODEC(ZSTD(1));
ALTER TABLE otel_metrics_summary ADD COLUMN IF NOT EXISTS ScopeSchemaUrl String CODEC(ZSTD(1));

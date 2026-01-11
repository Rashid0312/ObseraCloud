
-- Patch to add ScopeDroppedAttrCount column to metrics tables - Corrected Syntax
ALTER TABLE otel_metrics_sum ADD COLUMN IF NOT EXISTS ScopeDroppedAttrCount UInt32 DEFAULT 0 CODEC(ZSTD(1));
ALTER TABLE otel_metrics_gauge ADD COLUMN IF NOT EXISTS ScopeDroppedAttrCount UInt32 DEFAULT 0 CODEC(ZSTD(1));
ALTER TABLE otel_metrics_histogram ADD COLUMN IF NOT EXISTS ScopeDroppedAttrCount UInt32 DEFAULT 0 CODEC(ZSTD(1));
ALTER TABLE otel_metrics_exponential_histogram ADD COLUMN IF NOT EXISTS ScopeDroppedAttrCount UInt32 DEFAULT 0 CODEC(ZSTD(1));
ALTER TABLE otel_metrics_summary ADD COLUMN IF NOT EXISTS ScopeDroppedAttrCount UInt32 DEFAULT 0 CODEC(ZSTD(1));

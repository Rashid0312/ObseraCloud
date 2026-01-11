
ALTER TABLE otel_metrics_sum ADD COLUMN IF NOT EXISTS ResourceSchemaUrl String;
ALTER TABLE otel_metrics_gauge ADD COLUMN IF NOT EXISTS ResourceSchemaUrl String;
ALTER TABLE otel_metrics_histogram ADD COLUMN IF NOT EXISTS ResourceSchemaUrl String;
ALTER TABLE otel_metrics_exponential_histogram ADD COLUMN IF NOT EXISTS ResourceSchemaUrl String;
ALTER TABLE otel_metrics_summary ADD COLUMN IF NOT EXISTS ResourceSchemaUrl String;

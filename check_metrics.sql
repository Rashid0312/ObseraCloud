
SELECT count(*) FROM otel_metrics_sum;
SELECT count(*) FROM otel_metrics_gauge;
SELECT DISTINCT ResourceAttributes['tenant_id'] FROM otel_metrics_sum;

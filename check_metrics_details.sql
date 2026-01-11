
SELECT count(*) FROM otel_metrics_sum;
SELECT count(*) FROM otel_metrics_gauge;
SELECT count(*) FROM otel_metrics_histogram;
SELECT MetricName, ResourceAttributes['service.name'], ResourceAttributes['tenant_id'] FROM otel_metrics_gauge LIMIT 10;

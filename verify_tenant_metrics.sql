
SELECT 
    'Sum' as Table,
    MetricName, 
    ResourceAttributes['tenant_id'] as Tenant,
    count(*) as Points
FROM otel_metrics_sum 
GROUP BY MetricName, Tenant
UNION ALL
SELECT 
    'Histogram',
    MetricName, 
    ResourceAttributes['tenant_id'] as Tenant,
    count(*) as Points
FROM otel_metrics_histogram 
GROUP BY MetricName, Tenant;

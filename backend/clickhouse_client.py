import clickhouse_connect
import os
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

# Environment Configuration
CH_HOST = os.getenv("CLICKHOUSE_HOST", "localhost")
CH_PORT = int(os.getenv("CLICKHOUSE_PORT", "8123"))
CH_USER = os.getenv("CLICKHOUSE_USER", "default")
CH_PASSWORD = os.getenv("CLICKHOUSE_PASSWORD", "")

_client = None

def get_client():
    """Get or create ClickHouse client"""
    global _client
    if _client is None:
        try:
            _client = clickhouse_connect.get_client(
                host=CH_HOST,
                port=CH_PORT,
                username=CH_USER,
                password=CH_PASSWORD,
                connect_timeout=5
            )
            logger.info(f"Connected to ClickHouse at {CH_HOST}:{CH_PORT}")
        except Exception as e:
            logger.error(f"Failed to connect to ClickHouse: {e}")
            return None
    return _client

def execute_query(query, parameters=None):
    """Execute a SQL query and return dict results"""
    client = get_client()
    if not client:
        raise Exception("Database connection unavailable")
    
    try:
        # Use simple execution for now, clickhouse-connect handles escaping in parameters mostly for inserts
        # For selects, we should use binding if supported or careful formatting
        # clickhouse-connect 'query' method supports 'parameters' dict
        result = client.query(query, parameters=parameters)
        
        # Convert to list of dicts
        columns = result.column_names
        data = []
        for row in result.result_rows:
            item = {}
            for i, col in enumerate(columns):
                item[col] = row[i]
            data.append(item)
            
        return data
    except Exception as e:
        logger.error(f"Query Syntax Error: {query}")
        logger.error(f"Query Error: {e}")
        raise e

# ==========================================
# QUERY HELPERS
# ==========================================

def get_logs(tenant_id, severity=None, start_time=None, end_time=None, limit=100):
    """Fetch logs from ClickHouse"""
    params = {'tenant_id': tenant_id, 'limit': limit}
    
    where_clauses = ["ResourceAttributes['tenant_id'] = %(tenant_id)s"]
    
    if severity:
        where_clauses.append("SeverityText = %(severity)s")
        params['severity'] = severity.upper()
        
    if start_time:
        where_clauses.append("Timestamp >= %(start_time)s")
        params['start_time'] = start_time
        
    if end_time:
        where_clauses.append("Timestamp <= %(end_time)s")
        params['end_time'] = end_time
        
    where_sql = " AND ".join(where_clauses)
    
    query = f"""
        SELECT 
            Timestamp, 
            SeverityText, 
            Body, 
            ServiceName, 
            TraceId, 
            SpanId,
            LogAttributes
        FROM otel_logs
        WHERE {where_sql}
        ORDER BY Timestamp DESC
        LIMIT %(limit)s
    """
    
    return execute_query(query, params)

def get_traces(tenant_id, service_name=None, start_time=None, end_time=None, limit=100):
    """Fetch recent traces - deduplicated by TraceId using subquery"""
    params = {'tenant_id': tenant_id, 'limit': limit}
    
    where_clauses = [
        "ResourceAttributes['tenant_id'] = %(tenant_id)s"
    ]
    
    if service_name:
        where_clauses.append("ServiceName = %(service_name)s")
        params['service_name'] = service_name
        
    if start_time:
        where_clauses.append("Timestamp >= %(start_time)s")
        params['start_time'] = start_time
        
    if end_time:
        where_clauses.append("Timestamp <= %(end_time)s")
        params['end_time'] = end_time
        
    where_sql = " AND ".join(where_clauses)
    
    # Use subquery to deduplicate: get one span per TraceId, then order for display
    query = f"""
        SELECT * FROM (
            SELECT 
                TraceId,
                SpanId,
                ParentSpanId,
                SpanName AS RootTraceName,
                CASE 
                    WHEN ServiceName != '' THEN ServiceName 
                    ELSE ResourceAttributes['service.name']
                END AS RootServiceName,
                toUnixTimestamp64Nano(Timestamp) as StartTimeUnixNano,
                Duration as DurationNano,
                StatusCode,
                SpanAttributes,
                ResourceAttributes,
                Timestamp
            FROM otel_traces
            WHERE {where_sql}
            ORDER BY Timestamp ASC
            LIMIT 1 BY TraceId
        )
        ORDER BY StartTimeUnixNano DESC
        LIMIT %(limit)s
    """
    
    return execute_query(query, params)

def get_trace_spans(trace_id):
    """Fetch all spans for a specific trace"""
    params = {'trace_id': trace_id}
    
    query = """
        SELECT 
            TraceId,
            SpanId,
            ParentSpanId,
            SpanName as Name,
            ServiceName,
            toUnixTimestamp64Nano(Timestamp) as StartTimeUnixNano,
            toUnixTimestamp64Nano(Timestamp) + Duration as EndTimeUnixNano,
            Duration as DurationNano,
            StatusCode,
            StatusMessage,
            SpanAttributes,
            ResourceAttributes
        FROM otel_traces
        WHERE TraceId = %(trace_id)s
        ORDER BY StartTimeUnixNano ASC
    """
    
    return execute_query(query, params)

def get_metrics_sum(tenant_id, metric_name, start_time, end_time):
    """Fetch metric points from appropriate tables"""
    params = {
        'tenant_id': tenant_id,
        'metric_name': metric_name,
        'start': start_time,
        'end': end_time
    }
    
    # Query both Sum and Gauge tables as metrics might be in either
    query = """
        SELECT 
            toUnixTimestamp(TimeUnix) as TimestampUnix,
            Value,
            Attributes
        FROM otel_metrics_sum
        WHERE (ResourceAttributes['tenant_id'] = %(tenant_id)s OR Attributes['tenant_id'] = %(tenant_id)s)
          AND MetricName = %(metric_name)s
          AND TimeUnix BETWEEN %(start)s AND %(end)s
        
        UNION ALL
        
        SELECT 
            toUnixTimestamp(TimeUnix) as TimestampUnix,
            Value,
            Attributes
        FROM otel_metrics_gauge
        WHERE (ResourceAttributes['tenant_id'] = %(tenant_id)s OR Attributes['tenant_id'] = %(tenant_id)s)
          AND MetricName = %(metric_name)s
          AND TimeUnix BETWEEN %(start)s AND %(end)s
          
        ORDER BY TimestampUnix ASC
    """
    return execute_query(query, params)

def get_all_metrics(tenant_id, start_time, end_time):
    """Fetch ALL metric points for a tenant from both sum and gauge tables"""
    params = {
        'tenant_id': tenant_id,
        'start': start_time,
        'end': end_time
    }
    
    # Query both Sum and Gauge tables and include MetricName
    query = """
        SELECT 
            toUnixTimestamp(TimeUnix) as TimestampUnix,
            MetricName,
            Value,
            Attributes
        FROM otel_metrics_sum
        WHERE (ResourceAttributes['tenant_id'] = %(tenant_id)s OR Attributes['tenant_id'] = %(tenant_id)s)
          AND TimeUnix BETWEEN %(start)s AND %(end)s
        
        UNION ALL
        
        SELECT 
            toUnixTimestamp(TimeUnix) as TimestampUnix,
            MetricName,
            Value,
            Attributes
        FROM otel_metrics_gauge
        WHERE (ResourceAttributes['tenant_id'] = %(tenant_id)s OR Attributes['tenant_id'] = %(tenant_id)s)
          AND TimeUnix BETWEEN %(start)s AND %(end)s
          
        ORDER BY TimestampUnix ASC
    """
    return execute_query(query, params)


def get_recent_error_traces(tenant_id, minutes=5, limit=50):
    """
    Fetch failing traces from the last N minutes to help diagnose outages.
    Returns structured data for AI analysis.
    """
    conn = get_client()
    if not conn:
        return []

    # Calculate time window
    start_time = int((datetime.now().timestamp() - (minutes * 60)) * 1e9)
    
    params = {
        'tenant_id': tenant_id,
        'start_time': start_time,
        'limit': limit
    }
    
    # Select spans that are Errors or have high duration
    query = """
        SELECT
            TraceId,
            SpanId,
            SpanName,
            ServiceName,
            StatusMessage,
            StatusCode,
            StatusCode,
            Duration as DurationNano,
            SpanAttributes,
            toUnixTimestamp(Timestamp) as TimestampUnix
        FROM otel_traces
        WHERE ResourceAttributes['tenant_id'] = %(tenant_id)s
          AND toUnixTimestamp64Nano(Timestamp) >= %(start_time)s
          AND (StatusCode = 'STATUS_CODE_ERROR' OR Duration > 1000000000) -- Error or >1s
        ORDER BY Timestamp DESC
        LIMIT %(limit)s
    """
    
    return execute_query(query, params)


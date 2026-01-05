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
    """Fetch recent traces (all spans, not just root)"""
    params = {'tenant_id': tenant_id, 'limit': limit}
    
    where_clauses = [
        "ResourceAttributes['tenant_id'] = %(tenant_id)s"
        # Removed ParentSpanId = '' filter to get ALL spans for distributed tracing
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
    
    query = f"""
        SELECT 
            TraceId,
            SpanId,
            ParentSpanId,
            SpanName,
            ServiceName,
            toUnixTimestamp64Nano(Timestamp) as StartTimeUnixNano,
            Duration as DurationNano,
            StatusCode
        FROM otel_traces
        WHERE {where_sql}
        ORDER BY Timestamp DESC
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
    """Fetch metric points"""
    params = {
        'tenant_id': tenant_id,
        'metric_name': metric_name,
        'start': start_time,
        'end': end_time
    }
    
    query = """
        SELECT 
            toUnixTimestamp(Timestamp) as TimestampUnix,
            Value,
            Attributes
        FROM otel_metrics_sum
        WHERE ResourceAttributes['tenant_id'] = %(tenant_id)s
          AND MetricName = %(metric_name)s
          AND Timestamp BETWEEN %(start)s AND %(end)s
        ORDER BY Timestamp ASC
    """
    return execute_query(query, params)

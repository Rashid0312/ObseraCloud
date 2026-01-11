import clickhouse_client as ch
from datetime import datetime

def flatten_trace_for_ai(trace_id, tenant_id):
    """
    Fetches spans and logs for a trace and converts them into a 
    token-efficient text representation for the LLM.
    """
    
    # 1. Fetch Spans
    spans = ch.get_trace_spans(trace_id)
    if not spans:
        return None
        
    # 2. Fetch Correlated Logs (Using our new Fuzzy Logic implicitly via app logic, 
    # but here we might need to replicate or reuse the get_logs query logic.
    # For now, let's just fetch exact matches to keep it fast, or reuse the app logic if we can import it.
    # To avoid circular imports, we'll re-implement a lightweight fetch here).
    
    # Calculate time range for log fetch
    start_ns = min(int(s['StartTimeUnixNano']) for s in spans)
    end_ns = max(int(s['EndTimeUnixNano']) for s in spans)
    
    # Simple explicit query for now
    logs = ch.execute_query("""
        SELECT Timestamp, SeverityText, Body, ServiceName
        FROM otel_logs
        WHERE (TraceId = %(trace_id)s)
           OR (
               ResourceAttributes['tenant_id'] = %(tenant_id)s
               AND Timestamp BETWEEN toDateTime64(%(start)f, 9) AND toDateTime64(%(end)f, 9)
               AND ServiceName IN %(services)s
               AND Post_Fix_Logic_Needed = 0 -- Placeholder
           )
        ORDER BY Timestamp ASC
        LIMIT 50
    """, {
        'trace_id': trace_id, 
        'tenant_id': tenant_id,
        'start': start_ns / 1e9 - 2.0,
        'end': end_ns / 1e9 + 2.0,
        'services': list(set(s['ServiceName'] for s in spans))
    })
    
    # 3. Build Text Context
    lines = [f"Trace Diagnosis Context", f"Trace ID: {trace_id}", "="*40]
    
    # Timeline
    lines.append("\nExecution Flow:")
    start_base = start_ns
    
    for i, span in enumerate(spans):
        # Calculate relative time and duration
        rel_start = (int(span['StartTimeUnixNano']) - start_base) / 1_000_000 # ms
        duration = float(span['DurationNano']) / 1_000_000 # ms
        status = "Error" if span['StatusCode'] == 2 else "OK"
        
        # Indentation based on logical depth (simplified)
        indent = "  " * (0 if not span['ParentSpanId'] else 1) # Real depth needs tree traversal, simple hack for now
        
        line = f"{indent}{i+1}. [{rel_start:.0f}ms] {span['ServiceName']}: {span['Name']} ({duration:.0f}ms) - {status}"
        if span['StatusMessage']:
            line += f" -> Msg: {span['StatusMessage']}"
            
        # Check for specific attributes of interest
        attrs = span['SpanAttributes']
        if 'http.status_code' in attrs:
            line += f" [HTTP {attrs['http.status_code']}]"
        if 'db.statement' in attrs:
            line += f" [DB: {attrs['db.statement'][:50]}...]"
            
        lines.append(line)
        
    # Logs
    if logs:
        lines.append("\nRelated Logs:")
        for log in logs:
            lines.append(f"- [{log['SeverityText']}] {log['ServiceName']}: {log['Body']}")
            
    return "\n".join(lines)

import os
import google.generativeai as genai
import logging
from ai_context import flatten_trace_for_ai

logger = logging.getLogger(__name__)

# Configure Gemini
# Checks for GEMINI_API_KEY in environment
api_key = os.getenv("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)

# We use the 'flash' model for speed and low cost
MODEL_NAME = "gemini-2.5-flash"
try:
    model = genai.GenerativeModel(MODEL_NAME)
except Exception as e:
    logger.warning(f"Failed to initialize Gemini model: {e}")
    model = None

SYSTEM_PROMPT = """
You are an expert Site Reliability Engineer (SRE) specializing in Distributed Tracing.
Your job is to analyze the provided Waterfall Trace and Application Logs to diagnose the Root Cause of failure or latency.

Context Provided:
- A text representation of the Trace Spans (Service, Operation, Duration, Status).
- Correlated Application Logs (Errors, Warnings).

Instructions:
1. Identify the specific span(s) that caused the error or latency bottleneck.
2. Look for correlation with the provided logs (e.g. valid DB lock errors, timeouts).
3. Provide a concise diagnosis in Markdown.

Output Format:
## 🚨 Diagnosis
<1-2 sentences explaining the root cause>

## 📉 Evidence
- <Bullet point citing the specific span/log>
- <e.g. "Span 'UPDATE inventory' failed with 500">

## 💡 Recommendation
<Specific action to fix it>
"""

def diagnose_trace(trace_id, tenant_id):
    """
    Analyzes a trace using Gemini 1.5 Flash.
    Returns a dict with 'diagnosis' (Markdown) or 'error'.
    """
    if not api_key:
        return {"error": "AI Configuration Missing: GEMINI_API_KEY not found."}

    # 1. Build Context
    try:
        context_text = flatten_trace_for_ai(trace_id, tenant_id)
        if not context_text:
            return {"error": "Trace not found or contains no spans."}
    except Exception as e:
        logger.error(f"Error building trace context: {e}")
        return {"error": f"Failed to retrieve trace data: {str(e)}"}

    # 2. Call LLM
    try:
        response = model.generate_content(
            f"{SYSTEM_PROMPT}\n\n=== TRACE DATA ===\n{context_text}"
        )
        return {"diagnosis": response.text}
    except Exception as e:
        logger.error(f"Gemini API Error: {e}")
        return {"error": "AI Analysis Failed. Please verify your API Key."}


def analyze_outage(monitor_error, trace_data):
    """
    Analyzes an uptime outage by correlating it with recent traces.
    """
    if not api_key:
        return "AI Configuration Missing."
        
    if not trace_data:
        return "No recent traces found to correlate with this outage."

    # Summarize traces for context
    trace_summary = []
    for t in trace_data[:20]: # Limit to 20 traces
        trace_summary.append(
            f"- Span: {t.get('SpanName')} | Service: {t.get('ServiceName')} | "
            f"Status: {t.get('StatusCode')} | Error: {t.get('StatusMessage')} | "
            f"Duration: {int(t.get('DurationNano', 0)/1e6)}ms"
        )
    
    trace_context = "\n".join(trace_summary)
    
    prompt = f"""
    You are an intelligent SRE Assistant for SkyView.
    
    Context:
    A service monitor just detected an outage.
    Monitor Error: "{monitor_error}"
    
    Recent Trace Activity (Last 5 mins):
    {trace_context}
    
    Task:
    Analyze the recent traces to find the ROOT CAUSE of the monitor failure.
    - Did a dependency fail (Database, 3rd party API)?
    - Was there a latency spike?
    - Is it a code error (500s)?
    
    Output Format:
    Concise, 1-2 sentences explaining WHY the service is down based on the evidence.
    Example: "The service is down due to repeated 503 errors from the 'payment-gateway' dependency."
    If no correlation found, say "No obvious correlation found in recent traces."
    """
    
    try:
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        logger.error(f"AI Outage Analysis Failed: {e}")
        return "AI Analysis Failed."

from flask import Blueprint, request, jsonify
import requests
from datetime import datetime, timedelta
import json

query_bp = Blueprint('query', __name__)

PROMETHEUS_URL = "http://localhost:9090"
LOKI_URL = "http://localhost:3100"
TEMPO_URL = "http://localhost:3200"

@query_bp.route('/metrics/range', methods=['GET'])
def query_metrics():
    """Query Prometheus time-series data"""
    metric = request.args.get('metric', 'http_requests_total')
    hours = int(request.args.get('hours', 1))
    
    query = f'rate({metric}[5m])'
    end_time = datetime.now()
    start_time = end_time - timedelta(hours=hours)
    
    try:
        response = requests.get(f"{PROMETHEUS_URL}/api/v1/query_range", params={
            'query': query,
            'start': start_time.timestamp(),
            'end': end_time.timestamp(),
            'step': '15s'
        })
        return jsonify(response.json())
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@query_bp.route('/logs', methods=['GET'])
def query_logs():
    """Query Loki logs with LogQL"""
    tenant_id = request.args.get('tenant_id')
    if not tenant_id:
        return jsonify({'error': 'tenant_id required'}), 400
    
    limit = request.args.get('limit', 50)
    level = request.args.get('level', '')
    
    # Query with correct label: service_name
    if level:
        query = f'{{service_name="demo-app"}} | json | severity_text="{level}"'
    else:
        query = '{service_name="demo-app"}'
    
    try:
        response = requests.get(f"{LOKI_URL}/loki/api/v1/query_range", params={
            'query': query,
            'limit': limit
        })
        data = response.json()
        
        logs = []
        if data.get('status') == 'success' and 'data' in data:
            for stream in data['data'].get('result', []):
                stream_labels = stream.get('stream', {})
                for entry in stream.get('values', []):
                    timestamp_ns, message = entry
                    logs.append({
                        'timestamp': datetime.fromtimestamp(int(timestamp_ns) / 1e9).isoformat(),
                        'level': stream_labels.get('severity_text', 'INFO'),
                        'message': message,
                        'service': stream_labels.get('service_name', 'demo-app')
                    })
        
        return jsonify({'logs': logs}), 200
    except Exception as e:
        return jsonify({'error': str(e), 'logs': []}), 500

@query_bp.route('/traces/search', methods=['GET'])
def search_traces():
    """Search Tempo traces"""
    service = request.args.get('service', 'demo-service')
    limit = request.args.get('limit', 20)
    
    try:
        response = requests.get(f"{TEMPO_URL}/api/search", params={
            'service.name': service,
            'limit': limit
        })
        return jsonify(response.json())
    except Exception as e:
        return jsonify({'error': str(e)}), 500

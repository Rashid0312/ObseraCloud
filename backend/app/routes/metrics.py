from flask import Blueprint, jsonify, request
import requests

bp = Blueprint('metrics', __name__, url_prefix='/api/metrics')

PROMETHEUS_URL = "http://localhost:9090"

@bp.route('', methods=['GET', 'OPTIONS'])
@bp.route('/', methods=['GET', 'OPTIONS'])
def get_metrics():
    if request.method == 'OPTIONS':
        return '', 200
    
    tenant_id = request.args.get('tenant_id')
    if not tenant_id:
        return jsonify({'error': 'tenant_id required'}), 400
    
    # Query the actual metric name from Prometheus
    query = 'demo_http_requests_total'
    
    try:
        response = requests.get(f"{PROMETHEUS_URL}/api/v1/query", params={
            'query': query
        }, timeout=5)
        data = response.json()
        
        if data.get('status') == 'success':
            # Transform to match frontend format
            metrics = []
            for item in data['data']['result']:
                metrics.append({
                    'metric': {
                        '__name__': item['metric'].get('__name__', ''),
                        'endpoint': item['metric'].get('endpoint', ''),
                        'status': item['metric'].get('status', '')
                    },
                    'value': item['value']
                })
            return jsonify({'metrics': metrics}), 200
        else:
            return jsonify({'error': 'Prometheus query failed', 'metrics': []}), 500
    except Exception as e:
        return jsonify({'error': str(e), 'metrics': []}), 500

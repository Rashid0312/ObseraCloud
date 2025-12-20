from flask import Blueprint, jsonify, request
import requests

bp = Blueprint('traces', __name__, url_prefix='/api/traces')

TEMPO_URL = "http://localhost:3200"

@bp.route('', methods=['GET', 'OPTIONS'])
@bp.route('/', methods=['GET', 'OPTIONS'])
def get_traces():
    if request.method == 'OPTIONS':
        return '', 200
    
    tenant_id = request.args.get('tenant_id')
    if not tenant_id:
        return jsonify({'error': 'tenant_id required'}), 400
    
    limit = request.args.get('limit', 20)
    
    try:
        response = requests.get(f"{TEMPO_URL}/api/search", params={
            'limit': limit
        }, timeout=5)
        
        data = response.json()
        
        # Transform Tempo response to frontend format
        traces = []
        if 'traces' in data:
            for trace in data['traces']:
                traces.append({
                    'traceID': trace.get('traceID', ''),
                    'rootTraceName': trace.get('rootTraceName', 'Unknown'),
                    'rootServiceName': trace.get('rootServiceName', 'demo-app'),
                    'durationMs': trace.get('durationMs', 0),
                    'startTimeUnixNano': trace.get('startTimeUnixNano', 0)
                })
        
        return jsonify({'traces': traces}), 200
    except Exception as e:
        return jsonify({'error': str(e), 'traces': []}), 500

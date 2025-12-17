from flask import Blueprint, jsonify, request

bp = Blueprint('traces', __name__, url_prefix='/api/traces')

@bp.route('', methods=['GET', 'OPTIONS'])
@bp.route('/', methods=['GET', 'OPTIONS'])
def get_traces():
    if request.method == 'OPTIONS':
        return '', 200
    tenant_id = request.args.get('tenant_id')
    return jsonify([
        {'trace_id': 'abc123', 'duration_ms': 234, 'service': 'api-gateway', 'tenant_id': tenant_id},
        {'trace_id': 'def456', 'duration_ms': 567, 'service': 'auth-service', 'tenant_id': tenant_id}
    ]), 200

@bp.route('/search', methods=['GET'])
def search_traces():
    tenant_id = request.args.get('tenant_id')
    return jsonify({'message': f'Traces for {tenant_id}'}), 200

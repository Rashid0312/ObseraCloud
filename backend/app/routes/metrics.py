from flask import Blueprint, jsonify, request

bp = Blueprint('metrics', __name__, url_prefix='/api/metrics')

@bp.route('', methods=['GET', 'OPTIONS'])
@bp.route('/', methods=['GET', 'OPTIONS'])
def get_metrics():
    if request.method == 'OPTIONS':
        return '', 200
    tenant_id = request.args.get('tenant_id')
    return jsonify([
        {'metric': 'cpu_usage', 'value': 45.2, 'tenant_id': tenant_id},
        {'metric': 'memory_usage', 'value': 78.5, 'tenant_id': tenant_id}
    ]), 200

@bp.route('/query', methods=['GET'])
def query_metrics():
    tenant_id = request.args.get('tenant_id')
    return jsonify({'message': f'Metrics for {tenant_id}'}), 200

from flask import Blueprint, jsonify, request

bp = Blueprint('logs', __name__, url_prefix='/api/logs')

@bp.route('', methods=['GET', 'OPTIONS'])
@bp.route('/', methods=['GET', 'OPTIONS'])
def get_logs():
    if request.method == 'OPTIONS':
        return '', 200
    tenant_id = request.args.get('tenant_id')
    return jsonify([
        {'timestamp': '2025-12-17T01:30:00', 'level': 'INFO', 'message': 'Application started', 'tenant_id': tenant_id},
        {'timestamp': '2025-12-17T01:30:15', 'level': 'ERROR', 'message': 'Connection failed', 'tenant_id': tenant_id}
    ]), 200

@bp.route('/query', methods=['GET'])
def query_logs():
    tenant_id = request.args.get('tenant_id')
    return jsonify({'message': f'Logs for {tenant_id}'}), 200

@bp.route('/range', methods=['GET'])
def range_logs():
    tenant_id = request.args.get('tenant_id')
    return jsonify({'message': f'Log range for {tenant_id}'}), 200

from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
import bcrypt

bp = Blueprint('auth', __name__, url_prefix='/api/auth')

# API Key to Tenant mapping
api_keys = {
    'tenant1-secret-key-12345': 'acme-corp',
    'tenant2-secret-key-67890': 'techstart-io',
}

# Email/Password users (keep for future use)
users = {
    'admin@tenant-a.local': {
        'password': bcrypt.hashpw('password123'.encode(), bcrypt.gensalt()),
        'tenant_id': 'tenant-a'
    }
}

@bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    
    # Check if API key login
    if 'api_key' in data:
        api_key = data.get('api_key')
        tenant_id = api_keys.get(api_key)
        
        if tenant_id:
            token = create_access_token(
                identity=tenant_id,
                additional_claims={'tenant_id': tenant_id}
            )
            return jsonify({
                'access_token': token,
                'tenant_id': tenant_id
            }), 200
        else:
            return jsonify({'error': 'Invalid API key'}), 401
    
    # Check if email/password login
    elif 'email' in data and 'password' in data:
        email = data.get('email')
        password = data.get('password')
        
        user = users.get(email)
        if user and bcrypt.checkpw(password.encode(), user['password']):
            token = create_access_token(
                identity=email,
                additional_claims={'tenant_id': user['tenant_id']}
            )
            return jsonify({
                'access_token': token,
                'tenant_id': user['tenant_id']
            }), 200
    
    return jsonify({'error': 'Invalid credentials'}), 401

@bp.route('/register', methods=['POST'])
def register():
    return jsonify({'message': 'Registration endpoint'}), 200

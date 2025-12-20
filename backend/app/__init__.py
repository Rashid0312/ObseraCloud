from flask import Flask, jsonify
from flask_cors import CORS

def create_app():
    app = Flask(__name__)
    
    # CORS configuration - allow frontend to call backend
    CORS(app, origins=["http://localhost:5173"], supports_credentials=True)
    
    # Register blueprints
    from app.routes.query import query_bp
    app.register_blueprint(query_bp, url_prefix='/api')
    
    from app.routes.metrics import bp as metrics_bp
    app.register_blueprint(metrics_bp)  # already has /api/metrics prefix
    
    from app.routes.traces import bp as traces_bp
    app.register_blueprint(traces_bp)  # already has /api/traces prefix
    
    # Health check endpoint
    @app.route('/health')
    def health():
        return jsonify({'status': 'ok'}), 200
    
    return app

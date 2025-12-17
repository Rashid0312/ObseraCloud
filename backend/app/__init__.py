from flask import Flask
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from config import config

jwt = JWTManager()

def create_app(config_name='production'):
    app = Flask(__name__)
    app.config.from_object(config[config_name])
    
    # Initialize extensions
    jwt.init_app(app)
    
    # Fix CORS - allow frontend to make requests
    CORS(app, resources={r"/api/*": {"origins": "*", "methods": ["GET", "POST", "OPTIONS"], "allow_headers": ["Content-Type", "X-API-Key"]}})
    
    # Import blueprints
    from app.routes.auth import bp as auth_bp
    from app.routes.logs import bp as logs_bp
    from app.routes.metrics import bp as metrics_bp
    from app.routes.traces import bp as traces_bp
    
    # Register blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(logs_bp)
    app.register_blueprint(metrics_bp)
    app.register_blueprint(traces_bp)
    
    # Health check endpoint
    @app.route('/health')
    def health():
        return {'status': 'ok'}, 200
    
    return app

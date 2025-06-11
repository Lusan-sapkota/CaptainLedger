import os
from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager

from models.models import db  # Assuming db is initialized in models.models
from config.config import Config  # Import the Config class

# Import blueprints
from api.auth import auth_bp as api_auth_bp
from api.transactions import transactions_bp
from api.sync import sync_bp
# Add other blueprint imports if you have them (e.g., user_bp)

def create_app():
    app = Flask(__name__)
    
    # Load configuration from Config object
    app.config.from_object(Config)
    
    # Configure CORS properly to handle preflight requests and avoid redirects
    CORS(app,
        resources={r"/api/*": {"origins": ["http://localhost:8081"]}}, 
        # origins="*",
        supports_credentials=True,
        allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        expose_headers=["Content-Type", "X-Total-Count"])

    # Initialize extensions
    db.init_app(app)  # Initialize SQLAlchemy
    jwt = JWTManager(app)  # Initialize JWTManager AFTER config is loaded

    # Register blueprints
    app.register_blueprint(api_auth_bp, url_prefix='/api/auth')
    app.register_blueprint(transactions_bp, url_prefix='/api/transactions')
    app.register_blueprint(sync_bp, url_prefix='/api/sync')
    # Register other blueprints...

    # Add a status endpoint for health checks
    @app.route('/api/status', methods=['GET', 'OPTIONS'])
    def status():
        return {"status": "ok"}, 200
        
    return app

if __name__ == '__main__':
    app = create_app()
    print(f"Flask app running with JWT_SECRET_KEY starting with: {app.config.get('JWT_SECRET_KEY')[:10]}...")  # For verification
    app.run(host='0.0.0.0', port=5000, debug=True)
import os
from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager

from models.models import db  # Assuming db is initialized in models.models
from config.config import Config  # Import the Config class

# Import blueprints
from routes.auth import auth_bp
from routes.transactions import transactions_bp
from routes.sync import sync_bp
# Add other blueprint imports if you have them (e.g., user_bp)

def create_app():
    app = Flask(__name__)
    
    # Load configuration from Config object
    app.config.from_object(Config)
    
    CORS(app, resources={r"/api/*": {"origins": "*"}})  # Enable CORS
    
    db.init_app(app)  # Initialize SQLAlchemy
    JWTManager(app)  # Initialize JWTManager AFTER config is loaded

    # Register blueprints
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(transactions_bp, url_prefix='/api/transactions')
    app.register_blueprint(sync_bp, url_prefix='/api/sync')
    # Register other blueprints...

    # A simple status endpoint
    @app.route('/api/status', methods=['GET'])
    def status():
        return jsonify({'status': 'Backend is running'}), 200
        
    return app

if __name__ == '__main__':
    app = create_app()
    print(f"Flask app running with JWT_SECRET_KEY starting with: {app.config.get('JWT_SECRET_KEY')[:10]}...")  # For verification
    app.run(debug=True, host='0.0.0.0', port=5000)
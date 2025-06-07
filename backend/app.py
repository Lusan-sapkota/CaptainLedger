from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
import os
from pathlib import Path
import sys

# Add the current directory to the path so imports work correctly
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

# Import your modules
from models.models import db
from routes.auth import auth_bp
from routes.transactions import transactions_bp
from routes.sync import sync_bp

def create_app(config=None):
    # Remove instance_relative_config=True
    app = Flask(__name__)
    
    # Ensure the instance folder exists
    try:
        os.makedirs(app.instance_path, exist_ok=True)
        print(f"Instance path: {app.instance_path}")
    except OSError:
        pass
    
    # Load configuration
    if config:
        app.config.from_mapping(config)
    else:
        # Use absolute path to config file
        config_path = os.path.join(os.path.dirname(__file__), 'config', 'config.py')
        print(f"Loading config from: {config_path}")
        app.config.from_pyfile(config_path)
    
    # Print database URI to verify
    print(f"Database URI: {app.config.get('SQLALCHEMY_DATABASE_URI')}")
    
    # Initialize extensions
    CORS(app)
    JWTManager(app)
    db.init_app(app)
    
    # Register blueprints
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(transactions_bp, url_prefix='/api/transactions')
    app.register_blueprint(sync_bp, url_prefix='/api/sync')
    
    # Basic route
    @app.route('/')
    def home():
        return jsonify({"message": "Welcome to Captain Ledger API"})
    
    # Error handlers
    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "Not found"}), 404
    
    @app.errorhandler(500)
    def server_error(e):
        return jsonify({"error": "Server error"}), 500
    
    # Create tables
    with app.app_context():
        try:
            db.create_all()
            print("Tables created successfully")
        except Exception as e:
            print(f"Error creating tables: {e}")
    
    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, host='0.0.0.0', port=5000)
from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
import os
from models.models import db
from routes.auth import auth_bp
from routes.transactions import transactions_bp
from routes.sync import sync_bp

def create_app(config=None):
    app = Flask(__name__)
    
    # Load configuration
    if config:
        app.config.from_mapping(config)
    else:
        app.config.from_pyfile('config/config.py')
    
    # Initialize extensions
    CORS(app)
    JWTManager(app)
    db.init_app(app)
    
    # Register blueprints
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(transactions_bp, url_prefix='/api/transactions')
    app.register_blueprint(sync_bp, url_prefix='/api/sync')
    
    @app.route('/api/status')
    def status():
        return jsonify({'status': 'ok', 'message': 'CaptainLedger API is running'})
    
    @app.errorhandler(404)
    def not_found(e):
        return jsonify({'error': 'Not found'}), 404
    
    @app.errorhandler(500)
    def server_error(e):
        return jsonify({'error': 'Server error', 'message': str(e)}), 500
    
    with app.app_context():
        db.create_all()
    
    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, host='0.0.0.0', port=5000)
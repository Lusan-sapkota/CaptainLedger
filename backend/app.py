import os
from flask import Flask, jsonify, request, make_response
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv
from models.models import db
from api.auth import auth_bp
from api.transactions import transactions_bp
from api.loans import loans_bp
from api.investments import investments_bp
from api.budget import budget_bp
from api.sync import sync_bp
from api.currencies import currencies_bp
from api.notifications import notifications_bp  # Import notifications blueprint
from api.data_management import data_management_bp  # Import data management blueprint
from datetime import timedelta
from pathlib import Path
from tasks.scheduler import report_scheduler
from websocket.socket_server import socketio, init_app as init_socketio

def create_app():
    # Load environment variables from .env file
    load_dotenv()
    
    app = Flask(__name__)
    
    # Configuration with absolute paths
    BASE_DIR = Path(__file__).resolve().parent
    INSTANCE_DIR = BASE_DIR / 'instance'
    DB_FILE = INSTANCE_DIR / 'captainledger.db'
    
    # Ensure instance directory exists
    INSTANCE_DIR.mkdir(parents=True, exist_ok=True)
    
    # Configuration
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your-secret-key-here')
    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{DB_FILE}'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'jwt-secret-string')
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=30)
    
    # Initialize extensions
    db.init_app(app)
    jwt = JWTManager(app)
    CORS(app, 
         origins=["http://localhost:3000", "http://localhost:8081", "http://10.0.2.2:5000", 
                 "http://192.168.18.2:5000", "exp://192.168.1.100:8081", "*"],
         supports_credentials=True,
         allow_headers=["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"],
         methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
         expose_headers=["Content-Type", "Authorization"],
         automatic_options=True,
         send_wildcard=False,
         vary_header=True)  # Let Flask-CORS handle OPTIONS requests automatically

    # Add explicit OPTIONS handler to prevent redirect issues
    @app.before_request
    def handle_preflight():
        if request.method == "OPTIONS":
            response = make_response()
            response.headers.add("Access-Control-Allow-Origin", request.headers.get('Origin', '*'))
            response.headers.add('Access-Control-Allow-Headers', "Content-Type,Authorization,X-Requested-With,Accept,Origin")
            response.headers.add('Access-Control-Allow-Methods', "GET,PUT,POST,DELETE,OPTIONS")
            response.headers.add('Access-Control-Allow-Credentials', 'true')
            return response
    
    # Register blueprints
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(transactions_bp, url_prefix='/api/transactions')
    app.register_blueprint(loans_bp, url_prefix='/api/loans')
    app.register_blueprint(investments_bp, url_prefix='/api/investments')
    app.register_blueprint(budget_bp, url_prefix='/api/budget')
    app.register_blueprint(sync_bp, url_prefix='/api/sync')
    app.register_blueprint(currencies_bp, url_prefix='/api/currencies')
    app.register_blueprint(notifications_bp, url_prefix='/api/notifications')  # Register notifications blueprint
    app.register_blueprint(data_management_bp, url_prefix='/api/data')  # Register data management blueprint
    
    # Initialize WebSocket
    init_socketio(app)
    
    # Initialize report scheduler
    report_scheduler.init_app(app)
    
    # Create tables with better error handling
    with app.app_context():
        try:
            db.create_all()
            print("✅ Database tables created successfully")
        except Exception as e:
            print(f"❌ Error creating database tables: {e}")
            print("Run: python fix_db_complete.py to fix database issues")
    
    @app.route('/api/status')
    def status():
        return jsonify({'status': 'running', 'message': 'CaptainLedger API is operational'})
    
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({'error': 'Endpoint not found'}), 404
    
    @app.errorhandler(500)
    def internal_error(error):
        return jsonify({'error': 'Internal server error'}), 500
    
    # Remove the duplicate CORS configuration to avoid conflicts
    
    return app

if __name__ == '__main__':
    app = create_app()
    print(f"Flask app running with JWT_SECRET_KEY starting with: {app.config.get('JWT_SECRET_KEY')[:10]}...")
    # Use socketio.run instead of app.run to enable WebSocket support
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)
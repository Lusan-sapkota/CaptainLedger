import os
import sys
from pathlib import Path
from flask import Flask
from flask_sqlalchemy import SQLAlchemy

# Add the current directory to the path so imports work correctly
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from models.models import db, User, Transaction, SyncLog

def init_db():
    # Create app
    app = Flask(__name__, instance_relative_config=True)
    
    # Ensure instance folder exists
    os.makedirs(app.instance_path, exist_ok=True)
    
    # Configure app
    app.config.from_pyfile('config/config.py')
    
    # Initialize SQLAlchemy
    db.init_app(app)
    
    with app.app_context():
        print(f"Database URI: {app.config.get('SQLALCHEMY_DATABASE_URI')}")
        print("Dropping all tables...")
        db.drop_all()
        
        print("Creating all tables...")
        db.create_all()
        
        print("Tables created successfully!")
        
        # List all tables
        from sqlalchemy import inspect
        inspector = inspect(db.engine)
        tables = inspector.get_table_names()
        print(f"Created tables: {tables}")

if __name__ == "__main__":
    init_db()
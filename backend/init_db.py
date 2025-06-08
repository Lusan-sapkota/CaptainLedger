import os
import sys
from flask import Flask

# Add the current directory to the path so imports work correctly
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from models.models import db, User, Transaction, SyncLog # Ensure all your models are imported
from config.config import Config # Import the Config class

def init_db():
    app = Flask(__name__)
    app.config.from_object(Config) # Use the imported Config class
    
    db_uri = app.config['SQLALCHEMY_DATABASE_URI']
    
    if not db_uri or not db_uri.startswith('sqlite:///'):
        print(f"Error: SQLALCHEMY_DATABASE_URI is not a valid sqlite URI in config: {db_uri}")
        return

    # Extract the file path. For an absolute URI like 'sqlite:////path/to/db.sqlite',
    # db_file_path will be '/path/to/db.sqlite'.
    db_file_path = db_uri[len('sqlite:///'):]
    
    db_dir = os.path.dirname(db_file_path)

    # Ensure the directory for the SQLite DB exists and is writable
    try:
        if not os.path.exists(db_dir):
            print(f"Directory {db_dir} does not exist. Attempting to create.")
            os.makedirs(db_dir, mode=0o755, exist_ok=True) # mode 0o755 is rwxr-xr-x
            print(f"Successfully created directory: {db_dir}")
        elif not os.path.isdir(db_dir):
            print(f"Error: {db_dir} exists but is not a directory. Please remove it or rename it.")
            return
        else:
            print(f"Directory {db_dir} already exists.")

        # Check if directory is writable, attempt to make it writable if not
        if not os.access(db_dir, os.W_OK | os.X_OK): # Check for write and execute (traverse)
            print(f"Warning: Directory {db_dir} may not be writable/traversable. Attempting to set permissions to 0o755.")
            os.chmod(db_dir, 0o755)
            if not os.access(db_dir, os.W_OK | os.X_OK):
                 print(f"Error: Still unable to make {db_dir} writable/traversable. Please check permissions manually.")
                 return # Exit if we can't ensure writability
            print(f"Permissions set for {db_dir}.")

    except OSError as e:
        print(f"OSError while ensuring directory {db_dir} exists and is writable: {e}")
        return
    except Exception as e:
        print(f"An unexpected error occurred during directory setup for {db_dir}: {e}")
        return

    db.init_app(app)
    
    with app.app_context():
        print(f"Database URI: {app.config.get('SQLALCHEMY_DATABASE_URI')}")
        jwt_key = app.config.get('JWT_SECRET_KEY')
        print(f"Using JWT_SECRET_KEY starting with: {jwt_key[:10] if jwt_key else 'NOT SET'}...")
        
        try:
            print("Dropping all tables...")
            db.drop_all()
            
            print("Creating all tables...")
            db.create_all()
            
            print("Tables created successfully!")
            
            from sqlalchemy import inspect
            inspector = inspect(db.engine)
            tables = inspector.get_table_names()
            print(f"Created tables: {tables}")
            
            if 'users' in tables:
                table_info = inspector.get_columns('users')
                columns = [col['name'] for col in table_info]
                print("User table columns:", columns)
                if 'fullName' in columns and 'country' in columns:
                    print("✅ Columns 'fullName' and 'country' exist in users table.")
                else:
                    print("❌ Columns 'fullName' and/or 'country' are MISSING from users table. Check models.py.")
            else:
                print("❌ Users table not found!")
        except Exception as e:
            print(f"An error occurred during database operations (drop/create tables): {e}")
            print("Please ensure the database file path and permissions are correct.")

if __name__ == "__main__":
    init_db()
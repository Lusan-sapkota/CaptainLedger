import os
from datetime import timedelta
from dotenv import load_dotenv

# Determine the base directory of the backend project (backend/)
BASE_DIR = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))

# Load .env file from the base directory (backend/.env)
dotenv_path = os.path.join(BASE_DIR, '.env')
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path)
else:
    print(f"Warning: .env file not found at {dotenv_path}. JWT_SECRET_KEY and other .env vars might not be loaded.")

class Config:
    db_uri_from_env = os.getenv('SQLALCHEMY_DATABASE_URI')

    if db_uri_from_env and db_uri_from_env.startswith('sqlite:///'):
        # Ensure SQLite URI from .env is an absolute path
        relative_db_path = db_uri_from_env[len('sqlite:///'):]
        if not os.path.isabs(relative_db_path):
            # Prepend BASE_DIR to make it absolute.
            # The result should be like 'sqlite:////absolute/path/to/backend/instance/captainledger.db'
            SQLALCHEMY_DATABASE_URI = 'sqlite:///' + os.path.join(BASE_DIR, relative_db_path)
        else:
            # It was already an absolute path like sqlite:///C:/path or sqlite:////path
            SQLALCHEMY_DATABASE_URI = db_uri_from_env
    elif db_uri_from_env:
        # For other DB types (postgres, mysql), use as is from .env
        SQLALCHEMY_DATABASE_URI = db_uri_from_env
    else:
        # Fallback to default absolute path if not in .env
        SQLALCHEMY_DATABASE_URI = 'sqlite:///' + os.path.join(BASE_DIR, 'instance', 'captainledger.db')
    
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # JWT Configuration
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY')
    if not JWT_SECRET_KEY:
        print("CRITICAL WARNING: JWT_SECRET_KEY not set. Using a default, insecure key. SET THIS IN backend/.env")
        
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=int(os.getenv('JWT_ACCESS_TOKEN_EXPIRES_HOURS', '1')))
    JWT_TOKEN_LOCATION = ['headers']
    JWT_HEADER_NAME = 'Authorization'
    JWT_HEADER_TYPE = 'Bearer'

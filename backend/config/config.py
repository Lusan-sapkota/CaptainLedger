import os
from pathlib import Path

# Database configuration with absolute paths
BASE_DIR = Path(__file__).resolve().parent.parent  # This gets the backend directory
INSTANCE_DIR = BASE_DIR / 'instance'
DB_FILE = INSTANCE_DIR / 'captainledger.db'

# Ensure instance directory exists
INSTANCE_DIR.mkdir(exist_ok=True)

# Secret key for session
SECRET_KEY = os.environ.get('SECRET_KEY', 'dev_key_please_change_in_production')

# Configure SQLAlchemy
SQLALCHEMY_DATABASE_URI = f'sqlite:///{DB_FILE}'
SQLALCHEMY_TRACK_MODIFICATIONS = False

# JWT Config
JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'jwt_dev_key_change_in_production')
JWT_ACCESS_TOKEN_EXPIRES = 3600  # 1 hour

# Debug flag
DEBUG = True

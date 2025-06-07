import os

# Database settings
SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL', 'sqlite:///captainledger.db')
SQLALCHEMY_TRACK_MODIFICATIONS = False

# JWT settings
JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'dev-secret-key-change-in-production')
JWT_ACCESS_TOKEN_EXPIRES = 60 * 60 * 24 * 7  # 7 days

# General settings
SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
DEBUG = os.environ.get('FLASK_ENV', 'development') == 'development'
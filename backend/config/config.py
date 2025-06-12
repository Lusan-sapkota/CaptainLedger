import os
from datetime import timedelta
from pathlib import Path

# Base directory for absolute paths
BASE_DIR = Path(__file__).resolve().parent.parent

class Config:
    # Database configuration with absolute path
    SQLALCHEMY_DATABASE_URI = 'sqlite:///' + str(BASE_DIR / 'instance' / 'captainledger.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Security
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
    
    # JWT Configuration
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'jwt-dev-secret')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=30)
    JWT_TOKEN_LOCATION = ['headers']
    JWT_HEADER_NAME = 'Authorization'
    JWT_HEADER_TYPE = 'Bearer'

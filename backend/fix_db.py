import os
import sqlite3
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
import sys
from pathlib import Path

# Absolute paths to avoid any confusion
BASE_DIR = Path(__file__).resolve().parent
INSTANCE_DIR = BASE_DIR / 'instance'
DB_FILE = INSTANCE_DIR / 'captainledger.db'

def diagnose_issues():
    print("======= Database Diagnostics =======")
    print(f"Current working directory: {os.getcwd()}")
    print(f"Base directory: {BASE_DIR}")
    print(f"Instance directory exists: {INSTANCE_DIR.exists()}")
    print(f"Database file exists: {DB_FILE.exists()}")
    
    if DB_FILE.exists():
        print(f"Database file permissions: {oct(DB_FILE.stat().st_mode)[-3:]}")
        print(f"Database file owner: {DB_FILE.owner()}")
        print(f"Current user: {os.getlogin()}")
    
    print("\nTrying to access database directly with sqlite3...")
    try:
        conn = sqlite3.connect(str(DB_FILE))
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(users)")
        tables = cursor.fetchall()
        print(f"Successfully connected! Found user table structure: {tables}")
        conn.close()
        print("Direct SQLite connection works!")
    except Exception as e:
        print(f"Direct SQLite connection failed: {e}")

    print("\nChecking directory permissions...")
    try:
        print(f"Can write to instance dir: {os.access(INSTANCE_DIR, os.W_OK)}")
        if not os.access(INSTANCE_DIR, os.W_OK):
            print(f"Instance directory permissions: {oct(INSTANCE_DIR.stat().st_mode)[-3:]}")
    except Exception as e:
        print(f"Permission check error: {e}")

def fix_db_issues():
    print("\n======= Fixing Database Issues =======")
    
    # 1. Ensure instance directory exists with correct permissions
    if not INSTANCE_DIR.exists():
        print(f"Creating instance directory: {INSTANCE_DIR}")
        INSTANCE_DIR.mkdir(parents=True, exist_ok=True)
        INSTANCE_DIR.chmod(0o777)  # Set full permissions
    else:
        print(f"Setting instance directory permissions")
        INSTANCE_DIR.chmod(0o777)
    
    # 2. If DB exists but has wrong permissions, fix them
    if DB_FILE.exists():
        print(f"Setting database file permissions")
        DB_FILE.chmod(0o666)  # Read/write for all users
    
    # 3. Create a simple database with a test table to verify
    print("Creating/verifying test database...")
    conn = sqlite3.connect(str(DB_FILE))
    cursor = conn.cursor()
    cursor.execute("CREATE TABLE IF NOT EXISTS db_test (id INTEGER PRIMARY KEY, test TEXT)")
    cursor.execute("INSERT INTO db_test (test) VALUES ('Database connection successful')")
    conn.commit()
    conn.close()
    print("Test database created/verified successfully!")
    
    # 4. Update the config file to use absolute paths
    config_file = BASE_DIR / 'config' / 'config.py'
    if config_file.exists():
        print(f"Updating config file: {config_file}")
        with open(config_file, 'r') as f:
            config_content = f.read()
        
        # Add our absolute path configuration
        updated_config = f"""import os
from pathlib import Path

# Database configuration with absolute path
BASE_DIR = Path(__file__).resolve().parent.parent
INSTANCE_DIR = BASE_DIR / 'instance'
DB_FILE = INSTANCE_DIR / 'captainledger.db'

# Database settings
SQLALCHEMY_DATABASE_URI = f'sqlite:///{DB_FILE}'
SQLALCHEMY_TRACK_MODIFICATIONS = False

{config_content}
"""
        with open(config_file, 'w') as f:
            f.write(updated_config)
        print("Config file updated!")
    
    print("\nDatabase setup complete! Try running your app now.")

if __name__ == "__main__":
    diagnose_issues()
    
    confirm = input("\nWould you like to fix the database issues? (y/n): ")
    if confirm.lower() == 'y':
        fix_db_issues()
        print("\nRun the application with: python app.py")
    else:
        print("No changes made.")
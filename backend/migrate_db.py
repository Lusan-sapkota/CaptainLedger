import os
import sqlite3
from flask import Flask
from models.models import db

def migrate_database():
    """Add new columns to the users table"""
    print("Starting database migration...")
    
    # Get the database path from the environment
    db_path = os.environ.get('DATABASE_URL', 'sqlite:///instance/captainledger.db')
    
    # Strip sqlite:/// prefix if present
    if db_path.startswith('sqlite:///'):
        db_path = db_path[10:]
    
    try:
        # Connect to the SQLite database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if columns exist before adding them
        cursor.execute("PRAGMA table_info(users)")
        existing_columns = [column[1] for column in cursor.fetchall()]
        
        # List of columns to add with their types
        columns_to_add = {
            'gender': 'TEXT',
            'profile_picture': 'TEXT',
            'last_login': 'TIMESTAMP',
            'last_login_ip': 'TEXT',
            'last_login_device': 'TEXT',
            'last_login_location': 'TEXT',
            'is_active': 'BOOLEAN DEFAULT 1',
            'is_verified': 'BOOLEAN DEFAULT 0',
            'phone_number': 'TEXT',
            'bio': 'TEXT'
        }
        
        # Add columns that don't exist
        for column, type_info in columns_to_add.items():
            if column not in existing_columns:
                try:
                    cursor.execute(f"ALTER TABLE users ADD COLUMN {column} {type_info}")
                    print(f"✅ Added column '{column}' to users table")
                except sqlite3.OperationalError as e:
                    print(f"❌ Error adding column '{column}': {e}")
        
        conn.commit()
        conn.close()
        print("✅ Database migration completed successfully!")
        
    except Exception as e:
        print(f"❌ Database migration error: {e}")
        return False
    
    return True

if __name__ == "__main__":
    migrate_database()
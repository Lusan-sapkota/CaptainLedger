import os
import sqlite3
from datetime import datetime
import uuid
from flask import Flask
from models.models import db

def migrate_database():
    """Add new columns to the users table and create categories table if not exists"""
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
        
        # ========== USERS TABLE MIGRATION ==========
        cursor.execute("PRAGMA table_info(users)")
        existing_user_columns = [column[1] for column in cursor.fetchall()]
        
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
        
        for column, type_info in columns_to_add.items():
            if column not in existing_user_columns:
                try:
                    cursor.execute(f"ALTER TABLE users ADD COLUMN {column} {type_info}")
                    print(f"✅ Added column '{column}' to users table")
                except sqlite3.OperationalError as e:
                    print(f"❌ Error adding column '{column}': {e}")

        # ========== BUDGETS TABLE CREATION ==========
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='budgets';")
        if not cursor.fetchone():
            create_budgets_table_sql = """
            CREATE TABLE budgets (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                category TEXT NOT NULL,
                amount REAL NOT NULL,
                period TEXT DEFAULT 'monthly',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
            """
            cursor.execute(create_budgets_table_sql)
            print("✅ Created 'budgets' table")
        else:
            print("ℹ️ 'budgets' table already exists")

        
        # ========== CATEGORIES TABLE CREATION / MIGRATION ==========
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='categories';")
        if not cursor.fetchone():
            create_table_sql = """
            CREATE TABLE categories (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                color TEXT DEFAULT '#CCCCCC',
                type TEXT DEFAULT 'expense',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                CONSTRAINT _user_category_uc UNIQUE (user_id, name)
            );
            """
            cursor.execute(create_table_sql)
            print("✅ Created 'categories' table")
        else:
            print("ℹ️ 'categories' table already exists")

            # Check if 'type' column exists; add if missing
            cursor.execute("PRAGMA table_info(categories);")
            existing_category_columns = [col[1] for col in cursor.fetchall()]
            
            if 'type' not in existing_category_columns:
                try:
                    cursor.execute("ALTER TABLE categories ADD COLUMN type TEXT DEFAULT 'expense';")
                    print("✅ Added 'type' column to 'categories' table")
                except sqlite3.OperationalError as e:
                    print(f"❌ Error adding 'type' column: {e}")

        
    except Exception as e:
        print(f"❌ Database migration error: {e}")
        return False
    
    return True

if __name__ == "__main__":
    migrate_database()

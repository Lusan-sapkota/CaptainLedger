#!/usr/bin/env python3
"""
Database migration script to add missing columns to transactions table
"""

import sqlite3
import os
from datetime import datetime

def migrate_database():
    # Path to the database file
    db_path = os.path.join(os.path.dirname(__file__), 'instance', 'captainledger.db')
    
    if not os.path.exists(db_path):
        print("Database file not found. Please run init_db.py first.")
        return False
    
    # Backup the database first
    backup_path = f"{db_path}.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    print(f"Creating backup at: {backup_path}")
    
    try:
        # Create backup
        with open(db_path, 'rb') as original:
            with open(backup_path, 'wb') as backup:
                backup.write(original.read())
        print("✅ Backup created successfully")
    except Exception as e:
        print(f"❌ Failed to create backup: {e}")
        return False
    
    # Connect to database
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if columns already exist
        cursor.execute("PRAGMA table_info(transactions)")
        existing_columns = [row[1] for row in cursor.fetchall()]
        
        new_columns = [
            ('interest_rate', 'REAL'),
            ('roi_percentage', 'REAL'),
            ('lender_name', 'VARCHAR(100)'),
            ('investment_platform', 'VARCHAR(100)'),
            ('deadline', 'DATE'),
            ('linked_transaction_id', 'VARCHAR(36)')
        ]
        
        # Add missing columns
        for column_name, column_type in new_columns:
            if column_name not in existing_columns:
                sql = f"ALTER TABLE transactions ADD COLUMN {column_name} {column_type}"
                print(f"Adding column: {column_name}")
                cursor.execute(sql)
        
        conn.commit()
        print("✅ Database migration completed successfully")
        return True
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        conn.rollback()
        return False
        
    finally:
        conn.close()

if __name__ == "__main__":
    print("Starting database migration...")
    success = migrate_database()
    if success:
        print("Migration completed successfully!")
    else:
        print("Migration failed!")

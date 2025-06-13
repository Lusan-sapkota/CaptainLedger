import os
import shutil
import tempfile
import sqlite3
import json
import uuid
from datetime import datetime
from flask import Blueprint, jsonify, request, send_file, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from models.models import db, User, Transaction, Category, Budget, Loan, Investment, Account, SyncLog
from werkzeug.utils import secure_filename

data_management_bp = Blueprint('data_management_api', __name__)

@data_management_bp.route('/export', methods=['GET'])
@jwt_required()
def export_database():
    """Export user's data as SQLite database file"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
            
        # Create a temporary database file
        temp_dir = tempfile.mkdtemp()
        temp_db_path = os.path.join(temp_dir, f"captainledger_export_{user_id}.db")
        
        # Create a new SQLite database for export
        export_conn = sqlite3.connect(temp_db_path)
        export_cursor = export_conn.cursor()
        
        # Get user data
        transactions = Transaction.query.filter_by(user_id=user_id).all()
        categories = Category.query.filter_by(user_id=user_id).all()
        budgets = Budget.query.filter_by(user_id=user_id).all()
        loans = Loan.query.filter_by(user_id=user_id).all()
        investments = Investment.query.filter_by(user_id=user_id).all()
        accounts = Account.query.filter_by(user_id=user_id).all()
        
        # Create export metadata
        metadata = {
            'export_date': datetime.utcnow().isoformat(),
            'user_id': user_id,
            'email': user.email,
            'version': '1.0.0',
            'record_counts': {
                'transactions': len(transactions),
                'categories': len(categories),
                'budgets': len(budgets),
                'loans': len(loans),
                'investments': len(investments),
                'accounts': len(accounts)
            }
        }
        
        # Create tables in export database
        export_cursor.execute('''
            CREATE TABLE metadata (
                key TEXT PRIMARY KEY,
                value TEXT
            )
        ''')
        
        # Store metadata
        for key, value in metadata.items():
            if key == 'record_counts':
                value = json.dumps(value)
            export_cursor.execute('INSERT INTO metadata VALUES (?, ?)', (key, str(value)))
        
        # Create user table
        export_cursor.execute('''
            CREATE TABLE user_profile (
                id TEXT PRIMARY KEY,
                email TEXT,
                fullName TEXT,
                country TEXT,
                gender TEXT,
                phone_number TEXT,
                bio TEXT,
                preferred_currency TEXT,
                date_format TEXT,
                timezone TEXT,
                language TEXT,
                profile_picture TEXT
            )
        ''')
        
        # Insert user data
        export_cursor.execute(
            'INSERT INTO user_profile VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            (
                user_id, user.email, user.fullName, user.country, user.gender,
                user.phone_number, user.bio, user.preferred_currency,
                user.date_format, user.timezone, user.language, user.profile_picture
            )
        )
        
        # Create and populate transactions table
        export_cursor.execute('''
            CREATE TABLE transactions (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                amount REAL,
                currency TEXT,
                date TEXT,
                category TEXT,
                note TEXT,
                created_at TEXT,
                updated_at TEXT
            )
        ''')
        
        for t in transactions:
            export_cursor.execute(
                'INSERT INTO transactions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                (
                    t.id, t.user_id, t.amount, t.currency, 
                    t.date.isoformat() if t.date else None,
                    t.category, t.note,
                    t.created_at.isoformat() if t.created_at else None,
                    t.updated_at.isoformat() if t.updated_at else None
                )
            )
        
        # Create and populate categories table
        export_cursor.execute('''
            CREATE TABLE categories (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                name TEXT,
                color TEXT,
                icon TEXT,
                type TEXT,
                parent_id TEXT,
                created_at TEXT
            )
        ''')
        
        for c in categories:
            export_cursor.execute(
                'INSERT INTO categories VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                (
                    c.id, c.user_id, c.name, c.color, c.icon, c.type, c.parent_id,
                    c.created_at.isoformat() if c.created_at else None
                )
            )
        
        # Create and populate budgets table
        export_cursor.execute('''
            CREATE TABLE budgets (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                category TEXT,
                amount REAL,
                period TEXT,
                currency TEXT,
                start_date TEXT,
                end_date TEXT,
                created_at TEXT
            )
        ''')
        
        for b in budgets:
            export_cursor.execute(
                'INSERT INTO budgets VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                (
                    b.id, b.user_id, b.category, b.amount, b.period, b.currency,
                    b.start_date.isoformat() if b.start_date else None,
                    b.end_date.isoformat() if b.end_date else None,
                    b.created_at.isoformat() if b.created_at else None
                )
            )
            
        # Create and populate loans table
        export_cursor.execute('''
            CREATE TABLE loans (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                loan_type TEXT,
                amount REAL,
                currency TEXT,
                contact TEXT,
                status TEXT,
                date TEXT,
                deadline TEXT,
                interest_rate REAL,
                created_at TEXT
            )
        ''')
        
        for l in loans:
            export_cursor.execute(
                'INSERT INTO loans VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                (
                    l.id, l.user_id, l.loan_type, l.amount, l.currency, 
                    l.contact, l.status,
                    l.date.isoformat() if l.date else None,
                    l.deadline.isoformat() if l.deadline else None,
                    l.interest_rate, 
                    l.created_at.isoformat() if l.created_at else None
                )
            )
        
        # Commit all changes and close the connection
        export_conn.commit()
        export_conn.close()
        
        # Create a sync log entry
        sync_log = SyncLog(
            user_id=user_id,
            sync_type="export",
            table_name="all",
            records_affected=sum(metadata['record_counts'].values()),
            last_sync_time=datetime.utcnow(),
            sync_status="completed",
            device_info=request.headers.get('User-Agent', 'Unknown')
        )
        db.session.add(sync_log)
        db.session.commit()
        
        # Send file to client
        return send_file(
            temp_db_path,
            as_attachment=True,
            download_name=f"captainledger_data_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db",
            mimetype='application/octet-stream'
        )
        
    except Exception as e:
        current_app.logger.error(f"Error exporting database: {e}")
        return jsonify({'error': f"Failed to export data: {str(e)}"}), 500


@data_management_bp.route('/import', methods=['POST'])
@jwt_required()
def import_database():
    """Import user data from uploaded SQLite database file"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
            
        # Check if file was included in request
        if 'file' not in request.files:
            return jsonify({'error': 'No file part in the request'}), 400
            
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No selected file'}), 400
            
        # Check if it's a valid db file
        if not file.filename.endswith('.db'):
            return jsonify({'error': 'File must be a SQLite database (.db)'}), 400
            
        # Create a temporary file to store the uploaded database
        temp_dir = tempfile.mkdtemp()
        temp_db_path = os.path.join(temp_dir, secure_filename(file.filename))
        file.save(temp_db_path)
        
        # Connect to the uploaded database
        import_conn = sqlite3.connect(temp_db_path)
        import_conn.row_factory = sqlite3.Row  # This enables column access by name
        import_cursor = import_conn.cursor()
        
        # Verify metadata and structure
        try:
            import_cursor.execute("SELECT * FROM metadata WHERE key = 'version'")
            version_row = import_cursor.fetchone()
            if not version_row or version_row['value'] != '1.0.0':
                return jsonify({'error': 'Incompatible database version'}), 400
                
            import_cursor.execute("SELECT * FROM metadata WHERE key = 'user_id'")
            metadata_user_id = import_cursor.fetchone()['value']
            
            # Option to override user_id check with a parameter for transferring between accounts
            override_user_check = request.args.get('override_user_check', 'false').lower() == 'true'
            if metadata_user_id != user_id and not override_user_check:
                return jsonify({'error': 'Database belongs to a different user'}), 403
                
        except sqlite3.OperationalError:
            return jsonify({'error': 'Invalid database format'}), 400
            
        # Begin merging data
        merge_strategy = request.args.get('merge_strategy', 'newest_wins')
        records_imported = {
            'transactions': 0,
            'categories': 0,
            'budgets': 0,
            'loans': 0
        }
        
        # Import transactions
        try:
            import_cursor.execute("SELECT * FROM transactions")
            for row in import_cursor.fetchall():
                row_dict = dict(row)
                
                # Check if transaction already exists
                existing = Transaction.query.filter_by(id=row_dict['id']).first()
                
                if existing:
                    if merge_strategy == 'newest_wins':
                        # Compare dates to see which is newer
                        imported_date = datetime.fromisoformat(row_dict['updated_at']) if row_dict['updated_at'] else None
                        if not imported_date or (existing.updated_at and existing.updated_at >= imported_date):
                            continue
                    
                        # Update existing with imported data
                        existing.amount = row_dict['amount']
                        existing.currency = row_dict['currency']
                        existing.date = datetime.fromisoformat(row_dict['date']).date() if row_dict['date'] else None
                        existing.category = row_dict['category']
                        existing.note = row_dict['note']
                        existing.updated_at = datetime.utcnow()
                    elif merge_strategy == 'skip_existing':
                        continue
                    elif merge_strategy == 'keep_both':
                        # Generate new ID for the imported record
                        row_dict['id'] = str(uuid.uuid4())
                else:
                    # Create new transaction
                    transaction = Transaction(
                        id=row_dict['id'],
                        user_id=user_id,  # Use current user's ID
                        amount=row_dict['amount'],
                        currency=row_dict['currency'],
                        date=datetime.fromisoformat(row_dict['date']).date() if row_dict['date'] else None,
                        category=row_dict['category'],
                        note=row_dict['note'],
                        created_at=datetime.fromisoformat(row_dict['created_at']) if row_dict['created_at'] else datetime.utcnow(),
                        updated_at=datetime.utcnow()
                    )
                    db.session.add(transaction)
                
                records_imported['transactions'] += 1
                
        except sqlite3.OperationalError as e:
            current_app.logger.warning(f"Error importing transactions: {e}")
            
        # Import categories
        try:
            import_cursor.execute("SELECT * FROM categories")
            for row in import_cursor.fetchall():
                row_dict = dict(row)
                
                # Check if category already exists
                existing = Category.query.filter_by(user_id=user_id, name=row_dict['name']).first()
                
                if not existing:
                    category = Category(
                        id=row_dict['id'],
                        user_id=user_id,
                        name=row_dict['name'],
                        color=row_dict['color'],
                        icon=row_dict['icon'],
                        type=row_dict['type'],
                        parent_id=row_dict['parent_id'],
                        created_at=datetime.fromisoformat(row_dict['created_at']) if row_dict['created_at'] else datetime.utcnow()
                    )
                    db.session.add(category)
                    records_imported['categories'] += 1
                    
        except sqlite3.OperationalError as e:
            current_app.logger.warning(f"Error importing categories: {e}")
            
        # Import budgets
        try:
            import_cursor.execute("SELECT * FROM budgets")
            for row in import_cursor.fetchall():
                row_dict = dict(row)
                
                # Check if budget already exists (using category as identifier)
                existing = Budget.query.filter_by(user_id=user_id, category=row_dict['category']).first()
                
                if existing and merge_strategy != 'keep_both':
                    # Update the existing budget
                    existing.amount = row_dict['amount']
                    existing.period = row_dict['period']
                    existing.currency = row_dict['currency']
                    existing.start_date = datetime.fromisoformat(row_dict['start_date']).date() if row_dict['start_date'] else None
                    existing.end_date = datetime.fromisoformat(row_dict['end_date']).date() if row_dict['end_date'] else None
                else:
                    # Create new budget
                    budget = Budget(
                        id=row_dict['id'] if merge_strategy != 'keep_both' else str(uuid.uuid4()),
                        user_id=user_id,
                        category=row_dict['category'],
                        amount=row_dict['amount'],
                        period=row_dict['period'],
                        currency=row_dict['currency'],
                        start_date=datetime.fromisoformat(row_dict['start_date']).date() if row_dict['start_date'] else None,
                        end_date=datetime.fromisoformat(row_dict['end_date']).date() if row_dict['end_date'] else None,
                        created_at=datetime.fromisoformat(row_dict['created_at']) if row_dict['created_at'] else datetime.utcnow()
                    )
                    db.session.add(budget)
                
                records_imported['budgets'] += 1
                    
        except sqlite3.OperationalError as e:
            current_app.logger.warning(f"Error importing budgets: {e}")
            
        # Import loans
        try:
            import_cursor.execute("SELECT * FROM loans")
            for row in import_cursor.fetchall():
                row_dict = dict(row)
                
                # Check if loan already exists
                existing = Loan.query.filter_by(id=row_dict['id']).first()
                
                if existing and merge_strategy != 'keep_both':
                    # Update existing loan
                    existing.loan_type = row_dict['loan_type']
                    existing.amount = row_dict['amount']
                    existing.currency = row_dict['currency']
                    existing.contact = row_dict['contact']
                    existing.status = row_dict['status']
                    existing.date = datetime.fromisoformat(row_dict['date']).date() if row_dict['date'] else None
                    existing.deadline = datetime.fromisoformat(row_dict['deadline']).date() if row_dict['deadline'] else None
                    existing.interest_rate = row_dict['interest_rate']
                else:
                    # Create new loan
                    loan = Loan(
                        id=row_dict['id'] if merge_strategy != 'keep_both' else str(uuid.uuid4()),
                        user_id=user_id,
                        loan_type=row_dict['loan_type'],
                        amount=row_dict['amount'],
                        currency=row_dict['currency'],
                        contact=row_dict['contact'],
                        status=row_dict['status'],
                        date=datetime.fromisoformat(row_dict['date']).date() if row_dict['date'] else None,
                        deadline=datetime.fromisoformat(row_dict['deadline']).date() if row_dict['deadline'] else None,
                        interest_rate=row_dict['interest_rate'],
                        created_at=datetime.fromisoformat(row_dict['created_at']) if row_dict['created_at'] else datetime.utcnow()
                    )
                    db.session.add(loan)
                
                records_imported['loans'] += 1
                    
        except sqlite3.OperationalError as e:
            current_app.logger.warning(f"Error importing loans: {e}")
            
        # Close the import connection
        import_conn.close()
        
        # Create a sync log entry
        sync_log = SyncLog(
            user_id=user_id,
            sync_type="import",
            table_name="all",
            records_affected=sum(records_imported.values()),
            last_sync_time=datetime.utcnow(),
            sync_status="completed",
            device_info=request.headers.get('User-Agent', 'Unknown')
        )
        db.session.add(sync_log)
        
        # Commit all changes
        db.session.commit()
        
        # Return success response with import statistics
        return jsonify({
            'success': True,
            'message': 'Data imported successfully',
            'records_imported': records_imported,
            'total_records': sum(records_imported.values())
        })
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error importing database: {e}")
        return jsonify({'error': f"Failed to import data: {str(e)}"}), 500
        
    finally:
        # Clean up temporary files
        if 'temp_dir' in locals():
            shutil.rmtree(temp_dir, ignore_errors=True)


@data_management_bp.route('/import-options', methods=['GET'])
@jwt_required()
def get_import_options():
    """Get available import merge strategies"""
    return jsonify({
        'merge_strategies': [
            {
                'id': 'newest_wins',
                'name': 'Keep Newer Records',
                'description': 'When conflicts occur, keep the most recently updated record'
            },
            {
                'id': 'skip_existing',
                'name': 'Skip Existing Records',
                'description': 'Only import new records, don\'t modify existing ones'
            },
            {
                'id': 'keep_both',
                'name': 'Keep Both Records',
                'description': 'Import all records, creating duplicates if necessary'
            }
        ]
    })
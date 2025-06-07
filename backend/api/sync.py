from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from models.models import db, User, Transaction, SyncLog

sync_bp = Blueprint('sync', __name__)

@sync_bp.route('/upload', methods=['POST'])
@jwt_required()
def upload_data():
    current_user_id = get_jwt_identity()
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    # Process uploaded transactions
    if 'transactions' in data:
        for t_data in data['transactions']:
            # Check if transaction already exists
            transaction = Transaction.query.filter_by(id=t_data.get('id')).first()
            
            # Parse date
            try:
                transaction_date = datetime.strptime(t_data.get('date'), '%Y-%m-%d').date()
            except ValueError:
                continue
                
            if transaction:
                # Update existing transaction if it's newer
                if 'updated_at' in t_data:
                    client_updated_at = datetime.fromisoformat(t_data['updated_at'])
                    if client_updated_at > transaction.updated_at:
                        transaction.amount = float(t_data.get('amount', transaction.amount))
                        transaction.currency = t_data.get('currency', transaction.currency)
                        transaction.date = transaction_date
                        transaction.category = t_data.get('category', transaction.category)
                        transaction.note = t_data.get('note', transaction.note)
                        transaction.updated_at = datetime.utcnow()
                        transaction.is_synced = True
            else:
                # Create new transaction
                new_transaction = Transaction(
                    id=t_data.get('id'),
                    user_id=current_user_id,
                    amount=float(t_data.get('amount')),
                    currency=t_data.get('currency', 'USD'),
                    date=transaction_date,
                    category=t_data.get('category', 'Other'),
                    note=t_data.get('note', ''),
                    is_synced=True
                )
                db.session.add(new_transaction)
    
    # Update sync log
    user = User.query.get(current_user_id)
    if user:
        user.last_sync = datetime.utcnow()
        
    sync_log = SyncLog(
        user_id=current_user_id,
        last_sync_time=datetime.utcnow(),
        device_info=request.headers.get('User-Agent', 'Unknown device')
    )
    db.session.add(sync_log)
    
    db.session.commit()
    
    return jsonify({
        'message': 'Data uploaded successfully',
        'last_sync': datetime.utcnow().isoformat()
    })

@sync_bp.route('/download', methods=['GET'])
@jwt_required()
def download_data():
    current_user_id = get_jwt_identity()
    
    # Get last sync time from query params
    last_sync_str = request.args.get('last_sync')
    last_sync = None
    
    if last_sync_str:
        try:
            last_sync = datetime.fromisoformat(last_sync_str)
        except ValueError:
            pass
    
    # Get all unsynced transactions for the user
    query = Transaction.query.filter_by(user_id=current_user_id)
    
    if last_sync:
        query = query.filter(Transaction.updated_at > last_sync)
    
    transactions = query.all()
    
    # Update sync log
    user = User.query.get(current_user_id)
    if user:
        user.last_sync = datetime.utcnow()
        
    sync_log = SyncLog(
        user_id=current_user_id,
        last_sync_time=datetime.utcnow(),
        device_info=request.headers.get('User-Agent', 'Unknown device')
    )
    db.session.add(sync_log)
    
    db.session.commit()
    
    return jsonify({
        'transactions': [
            {
                'id': t.id,
                'amount': t.amount,
                'currency': t.currency,
                'date': t.date.isoformat(),
                'category': t.category,
                'note': t.note,
                'created_at': t.created_at.isoformat(),
                'updated_at': t.updated_at.isoformat()
            }
            for t in transactions
        ],
        'last_sync': datetime.utcnow().isoformat()
    })
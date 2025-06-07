from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from models.models import db, Transaction

transactions_bp = Blueprint('transactions', __name__)

@transactions_bp.route('/', methods=['GET'])
@jwt_required()
def get_transactions():
    current_user_id = get_jwt_identity()
    
    # Get query parameters for filtering
    category = request.args.get('category')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    # Base query
    query = Transaction.query.filter_by(user_id=current_user_id)
    
    # Apply filters if provided
    if category:
        query = query.filter_by(category=category)
    if start_date:
        try:
            start = datetime.strptime(start_date, '%Y-%m-%d').date()
            query = query.filter(Transaction.date >= start)
        except ValueError:
            pass
    if end_date:
        try:
            end = datetime.strptime(end_date, '%Y-%m-%d').date()
            query = query.filter(Transaction.date <= end)
        except ValueError:
            pass
    
    # Order by date (newest first)
    transactions = query.order_by(Transaction.date.desc()).all()
    
    return jsonify({
        'transactions': [
            {
                'id': t.id,
                'amount': t.amount,
                'currency': t.currency,
                'date': t.date.isoformat(),
                'category': t.category,
                'note': t.note
            }
            for t in transactions
        ]
    })

@transactions_bp.route('/', methods=['POST'])
@jwt_required()
def create_transaction():
    current_user_id = get_jwt_identity()
    data = request.get_json()
    
    if not data or not data.get('amount') or not data.get('date'):
        return jsonify({'error': 'Amount and date are required'}), 400
    
    # Parse date
    try:
        transaction_date = datetime.strptime(data['date'], '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400
    
    # Create transaction
    transaction = Transaction(
        user_id=current_user_id,
        amount=float(data['amount']),
        currency=data.get('currency', 'USD'),
        date=transaction_date,
        category=data.get('category', 'Other'),
        note=data.get('note', ''),
        is_synced=True
    )
    
    db.session.add(transaction)
    db.session.commit()
    
    return jsonify({
        'message': 'Transaction created successfully',
        'transaction': {
            'id': transaction.id,
            'amount': transaction.amount,
            'currency': transaction.currency,
            'date': transaction.date.isoformat(),
            'category': transaction.category,
            'note': transaction.note
        }
    }), 201

@transactions_bp.route('/<transaction_id>', methods=['PUT'])
@jwt_required()
def update_transaction(transaction_id):
    current_user_id = get_jwt_identity()
    transaction = Transaction.query.filter_by(
        id=transaction_id, user_id=current_user_id
    ).first()
    
    if not transaction:
        return jsonify({'error': 'Transaction not found'}), 404
    
    data = request.get_json()
    
    if 'amount' in data:
        transaction.amount = float(data['amount'])
    if 'currency' in data:
        transaction.currency = data['currency']
    if 'date' in data:
        try:
            transaction.date = datetime.strptime(data['date'], '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400
    if 'category' in data:
        transaction.category = data['category']
    if 'note' in data:
        transaction.note = data['note']
    
    transaction.updated_at = datetime.utcnow()
    transaction.is_synced = True
    
    db.session.commit()
    
    return jsonify({
        'message': 'Transaction updated successfully',
        'transaction': {
            'id': transaction.id,
            'amount': transaction.amount,
            'currency': transaction.currency,
            'date': transaction.date.isoformat(),
            'category': transaction.category,
            'note': transaction.note
        }
    })

@transactions_bp.route('/<transaction_id>', methods=['DELETE'])
@jwt_required()
def delete_transaction(transaction_id):
    current_user_id = get_jwt_identity()
    transaction = Transaction.query.filter_by(
        id=transaction_id, user_id=current_user_id
    ).first()
    
    if not transaction:
        return jsonify({'error': 'Transaction not found'}), 404
    
    db.session.delete(transaction)
    db.session.commit()
    
    return jsonify({
        'message': 'Transaction deleted successfully'
    })
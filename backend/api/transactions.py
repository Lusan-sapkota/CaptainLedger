from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timedelta
from models.models import db, Transaction, Category, User
import uuid
from sqlalchemy import func

transactions_bp = Blueprint('transactions', __name__)

# Get all transactions with filtering
@transactions_bp.route('/', methods=['GET'], strict_slashes=False)
@jwt_required()
def get_transactions():
    current_user_id = get_jwt_identity()
    
    # Get query parameters for filtering
    category = request.args.get('category')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    limit = request.args.get('limit', type=int)
    
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
    query = query.order_by(Transaction.date.desc())
    
    # Apply limit if provided
    if limit:
        query = query.limit(limit)
    
    transactions = query.all()
    
    return jsonify({
        'transactions': [
            {
                'id': t.id,
                'amount': t.amount,
                'currency': t.currency,
                'date': t.date.isoformat(),
                'category': t.category,
                'note': t.note,
                'created_at': t.created_at.isoformat() if t.created_at else None,
                'updated_at': t.updated_at.isoformat() if t.updated_at else None
            } for t in transactions
        ]
    }), 200

# Create a new transaction
@transactions_bp.route('/', methods=['POST'])
@jwt_required()
def create_transaction():
    current_user_id = get_jwt_identity()
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    if 'amount' not in data:
        return jsonify({'error': 'Amount is required'}), 400
    
    if 'date' not in data:
        return jsonify({'error': 'Date is required'}), 400
        
    # Parse date
    try:
        transaction_date = datetime.strptime(data['date'], '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400
    
    # Create transaction
    transaction = Transaction(
        id=data.get('id', str(uuid.uuid4())),
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
            'note': transaction.note,
            'created_at': transaction.created_at.isoformat() if transaction.created_at else None,
            'updated_at': transaction.updated_at.isoformat() if transaction.updated_at else None
        }
    }), 201

# Update an existing transaction
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
            'note': transaction.note,
            'created_at': transaction.created_at.isoformat() if transaction.created_at else None,
            'updated_at': transaction.updated_at.isoformat() if transaction.updated_at else None
        }
    }), 200

# Delete a transaction
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
    }), 200

# Get monthly summary
@transactions_bp.route('/monthly-summary', methods=['GET'])
@jwt_required()
def get_monthly_summary():
    current_user_id = get_jwt_identity()
    
    # Get current month's start and end dates
    today = datetime.today()
    start_of_month = datetime(today.year, today.month, 1).date()
    if today.month == 12:
        end_of_month = datetime(today.year + 1, 1, 1).date() - timedelta(days=1)
    else:
        end_of_month = datetime(today.year, today.month + 1, 1).date() - timedelta(days=1)
    
    # Query transactions for current month
    transactions = Transaction.query.filter(
        Transaction.user_id == current_user_id,
        Transaction.date >= start_of_month,
        Transaction.date <= end_of_month
    ).all()
    
    # Calculate income, expenses, and balance
    income = sum(t.amount for t in transactions if t.amount > 0)
    expenses = sum(abs(t.amount) for t in transactions if t.amount < 0)
    balance = income - expenses
    
    # Get currency (use most common or default to USD)
    currency_counts = {}
    for t in transactions:
        currency_counts[t.currency] = currency_counts.get(t.currency, 0) + 1
    
    currency = 'USD'  # default
    if currency_counts:
        currency = max(currency_counts.items(), key=lambda x: x[1])[0]
    
    # Get category breakdown for expenses
    categories = {}
    for t in transactions:
        if t.amount < 0:  # Only for expenses
            category = t.category or 'Other'
            if category not in categories:
                categories[category] = 0
            categories[category] += abs(t.amount)
    
    category_list = [{'name': k, 'amount': v} for k, v in categories.items()]
    
    return jsonify({
        'period': f"{start_of_month.strftime('%B %Y')}",
        'income': income,
        'expenses': expenses,
        'balance': balance,
        'currency': currency,
        'categories': category_list
    }), 200

# Get/manage categories
@transactions_bp.route('/categories', methods=['GET'])
@jwt_required()
def get_categories():
    current_user_id = get_jwt_identity()
    
    # Default categories
    default_categories = [
        {'name': 'Food', 'color': '#FF5722'},
        {'name': 'Transport', 'color': '#2196F3'},
        {'name': 'Entertainment', 'color': '#9C27B0'},
        {'name': 'Bills', 'color': '#F44336'},
        {'name': 'Shopping', 'color': '#E91E63'},
        {'name': 'Health', 'color': '#4CAF50'},
        {'name': 'Income', 'color': '#8BC34A'},
        {'name': 'Housing', 'color': '#795548'},
        {'name': 'Education', 'color': '#3F51B5'},
        {'name': 'Travel', 'color': '#009688'},
        {'name': 'Salary', 'color': '#4CAF50'},
        {'name': 'Investments', 'color': '#673AB7'},
        {'name': 'Gifts', 'color': '#FFC107'},
        {'name': 'Loan', 'color': '#FF9800'},
        {'name': 'Personal Care', 'color': '#CDDC39'},
        {'name': 'Other', 'color': '#607D8B'}
    ]
    
    # Get user's custom categories
    custom_categories = Category.query.filter_by(user_id=current_user_id).all()
    
    # Combine default and custom categories
    custom_category_names = {c.name for c in custom_categories}
    categories = [c for c in default_categories if c['name'] not in custom_category_names]
    
    for c in custom_categories:
        categories.append({
            'name': c.name,
            'color': c.color
        })
    
    return jsonify({
        'categories': categories
    }), 200

# Add custom category
@transactions_bp.route('/categories', methods=['POST'])
@jwt_required()
def add_category():
    current_user_id = get_jwt_identity()
    data = request.get_json()
    
    if not data or not data.get('name'):
        return jsonify({'error': 'Category name is required'}), 400
    
    name = data['name'].strip()
    color = data.get('color', '#CCCCCC')
    type = data.get('type', 'expense')  # Default to expense if not specified
    
    # Validate type
    if type not in ['income', 'expense']:
        return jsonify({'error': 'Category type must be either "income" or "expense"'}), 400
    
    # Check if category already exists
    existing = Category.query.filter_by(user_id=current_user_id, name=name).first()
    if existing:
        return jsonify({'error': 'Category already exists'}), 400
        
    # Create new category
    category = Category(
        user_id=current_user_id,
        name=name,
        color=color,
        type=type
    )
    
    db.session.add(category)
    db.session.commit()
    
    return jsonify({
        'message': 'Category added successfully',
        'category': {
            'id': category.id,
            'name': category.name,
            'color': category.color,
            'type': category.type
        }
    }), 201

# Delete custom category
@transactions_bp.route('/categories/<category_name>', methods=['DELETE'])
@jwt_required()
def delete_category(category_name):
    current_user_id = get_jwt_identity()
    category = Category.query.filter_by(
        user_id=current_user_id, name=category_name
    ).first()
    
    if not category:
        return jsonify({'error': 'Category not found'}), 404
    
    db.session.delete(category)
    db.session.commit()
    
    return jsonify({
        'message': 'Category deleted successfully'
    }), 200
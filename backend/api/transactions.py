from flask import Blueprint, request, jsonify, make_response
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from models.models import db, Transaction
import uuid

transactions_bp = Blueprint('transactions', __name__)

# OPTIONS requests are now handled automatically by Flask-CORS

@transactions_bp.route('/', methods=['GET'])
@jwt_required()
def get_transactions():
    try:
        current_user_id = get_jwt_identity()
        
        if not current_user_id:
            return jsonify({'error': 'Authentication required'}), 401
        
        # Get query parameters for filtering
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        transaction_type = request.args.get('transaction_type')
        category = request.args.get('category')
        
        query = Transaction.query.filter_by(user_id=current_user_id)
        
        # Apply filters
        if start_date:
            try:
                start_date_obj = datetime.strptime(start_date, '%Y-%m-%d').date()
                query = query.filter(Transaction.date >= start_date_obj)
            except ValueError:
                return jsonify({'error': 'Invalid start_date format. Use YYYY-MM-DD'}), 400
        
        if end_date:
            try:
                end_date_obj = datetime.strptime(end_date, '%Y-%m-%d').date()
                query = query.filter(Transaction.date <= end_date_obj)
            except ValueError:
                return jsonify({'error': 'Invalid end_date format. Use YYYY-MM-DD'}), 400
        
        if transaction_type:
            query = query.filter_by(transaction_type=transaction_type)
        
        if category:
            query = query.filter_by(category=category)
        
        transactions = query.order_by(Transaction.date.desc()).all()
        
        transactions_data = []
        for t in transactions:
            transaction_dict = {
                'id': t.id,
                'amount': t.amount,
                'currency': t.currency,
                'date': t.date.isoformat(),
                'category': t.category,
                'note': t.note,
                'transaction_type': t.transaction_type,
                'status': t.status,
                'created_at': t.created_at.isoformat() if t.created_at else None,
                'updated_at': t.updated_at.isoformat() if t.updated_at else None
            }
            
            # Add loan-specific fields if applicable
            if t.transaction_type in ['loan', 'loan_repayment']:
                transaction_dict.update({
                    'interest_rate': t.interest_rate,
                    'lender_name': t.lender_name,
                    'deadline': t.deadline.isoformat() if t.deadline else None,
                    'linked_transaction_id': t.linked_transaction_id
                })
            
            # Add investment-specific fields if applicable
            if t.transaction_type in ['investment', 'investment_return']:
                transaction_dict.update({
                    'roi_percentage': t.roi_percentage,
                    'investment_platform': t.investment_platform,
                    'deadline': t.deadline.isoformat() if t.deadline else None,
                    'linked_transaction_id': t.linked_transaction_id
                })
            
            transactions_data.append(transaction_dict)
        
        return jsonify({
            'transactions': transactions_data,
            'total_count': len(transactions_data)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@transactions_bp.route('/', methods=['POST'])
@jwt_required()
def create_transaction():
    try:
        current_user_id = get_jwt_identity()
        
        if not current_user_id:
            return jsonify({'error': 'Authentication required'}), 401
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Validate required fields
        required_fields = ['amount', 'date', 'category']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'{field} is required'}), 400
        
        # Parse date
        try:
            transaction_date = datetime.strptime(data['date'], '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400
        
        # Parse deadline if provided
        deadline = None
        if data.get('deadline'):
            try:
                deadline = datetime.strptime(data['deadline'], '%Y-%m-%d').date()
            except ValueError:
                return jsonify({'error': 'Invalid deadline format. Use YYYY-MM-DD'}), 400
        
        # Create transaction
        transaction = Transaction(
            id=data.get('id', str(uuid.uuid4())),
            user_id=current_user_id,
            amount=float(data['amount']),
            currency=data.get('currency', 'USD'),
            date=transaction_date,
            category=data['category'],
            note=data.get('note', ''),
            transaction_type=data.get('transaction_type', 'regular'),
            interest_rate=float(data['interest_rate']) if data.get('interest_rate') else None,
            roi_percentage=float(data['roi_percentage']) if data.get('roi_percentage') else None,
            lender_name=data.get('lender_name'),
            investment_platform=data.get('investment_platform'),
            status=data.get('status', 'active'),
            linked_transaction_id=data.get('linked_transaction_id'),
            deadline=deadline,
            is_synced=True
        )
        
        db.session.add(transaction)
        db.session.commit()
        
        # Return the created transaction
        response_data = {
            'id': transaction.id,
            'amount': transaction.amount,
            'currency': transaction.currency,
            'date': transaction.date.isoformat(),
            'category': transaction.category,
            'note': transaction.note,
            'transaction_type': transaction.transaction_type,
            'status': transaction.status,
            'created_at': transaction.created_at.isoformat() if transaction.created_at else None,
            'updated_at': transaction.updated_at.isoformat() if transaction.updated_at else None
        }
        
        # Add type-specific fields
        if transaction.transaction_type in ['loan', 'loan_repayment']:
            response_data.update({
                'interest_rate': transaction.interest_rate,
                'lender_name': transaction.lender_name,
                'deadline': transaction.deadline.isoformat() if transaction.deadline else None
            })
        
        if transaction.transaction_type in ['investment', 'investment_return']:
            response_data.update({
                'roi_percentage': transaction.roi_percentage,
                'investment_platform': transaction.investment_platform,
                'deadline': transaction.deadline.isoformat() if transaction.deadline else None
            })
        
        return jsonify({
            'message': 'Transaction created successfully',
            'transaction': response_data
        }, 201)
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@transactions_bp.route('/<transaction_id>', methods=['PUT'])
@jwt_required(optional=True)
def update_transaction(transaction_id):
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Find the transaction
        transaction = Transaction.query.filter_by(
            id=transaction_id, 
            user_id=current_user_id
        ).first()
        
        if not transaction:
            return jsonify({'error': 'Transaction not found'}), 404
        
        # Update fields
        if 'amount' in data:
            transaction.amount = float(data['amount'])
        
        if 'currency' in data:
            transaction.currency = data['currency']
        
        if 'date' in data:
            try:
                transaction.date = datetime.strptime(data['date'], '%Y-%m-%d').date()
            except ValueError:
                return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400
        
        if 'deadline' in data:
            if data['deadline']:
                try:
                    transaction.deadline = datetime.strptime(data['deadline'], '%Y-%m-%d').date()
                except ValueError:
                    return jsonify({'error': 'Invalid deadline format. Use YYYY-MM-DD'}), 400
            else:
                transaction.deadline = None
        
        if 'category' in data:
            transaction.category = data['category']
        
        if 'note' in data:
            transaction.note = data['note']
        
        if 'transaction_type' in data:
            transaction.transaction_type = data['transaction_type']
        
        if 'interest_rate' in data:
            transaction.interest_rate = float(data['interest_rate']) if data['interest_rate'] else None
        
        if 'roi_percentage' in data:
            transaction.roi_percentage = float(data['roi_percentage']) if data['roi_percentage'] else None
        
        if 'lender_name' in data:
            transaction.lender_name = data['lender_name']
        
        if 'investment_platform' in data:
            transaction.investment_platform = data['investment_platform']
        
        if 'status' in data:
            transaction.status = data['status']
        
        if 'linked_transaction_id' in data:
            transaction.linked_transaction_id = data['linked_transaction_id']
        
        transaction.updated_at = datetime.utcnow()
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
                'transaction_type': transaction.transaction_type,
                'interest_rate': transaction.interest_rate,
                'roi_percentage': transaction.roi_percentage,
                'lender_name': transaction.lender_name,
                'investment_platform': transaction.investment_platform,
                'status': transaction.status,
                'deadline': transaction.deadline.isoformat() if transaction.deadline else None,
                'linked_transaction_id': transaction.linked_transaction_id,
                'updated_at': transaction.updated_at.isoformat()
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@transactions_bp.route('/<transaction_id>', methods=['DELETE'])
@jwt_required(optional=True)
def delete_transaction(transaction_id):
    try:
        current_user_id = get_jwt_identity()
        
        transaction = Transaction.query.filter_by(
            id=transaction_id, 
            user_id=current_user_id
        ).first()
        
        if not transaction:
            return jsonify({'error': 'Transaction not found'}), 404
        
        db.session.delete(transaction)
        db.session.commit()
        
        return jsonify({'message': 'Transaction deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Analytics endpoints
@transactions_bp.route('/analytics/summary', methods=['GET'])
@jwt_required(optional=True)
def get_transaction_summary():
    try:
        current_user_id = get_jwt_identity()
        
        # Get date range from query params
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        query = Transaction.query.filter_by(user_id=current_user_id)
        
        if start_date:
            start_date_obj = datetime.strptime(start_date, '%Y-%m-%d').date()
            query = query.filter(Transaction.date >= start_date_obj)
        
        if end_date:
            end_date_obj = datetime.strptime(end_date, '%Y-%m-%d').date()
            query = query.filter(Transaction.date <= end_date_obj)
        
        transactions = query.all()
        
        # Calculate summaries
        total_income = sum(t.amount for t in transactions if t.amount > 0)
        total_expenses = sum(abs(t.amount) for t in transactions if t.amount < 0)
        total_loans = sum(t.amount for t in transactions if t.transaction_type == 'loan')
        total_investments = sum(abs(t.amount) for t in transactions if t.transaction_type == 'investment')
        total_loan_repayments = sum(abs(t.amount) for t in transactions if t.transaction_type == 'loan_repayment')
        total_investment_returns = sum(t.amount for t in transactions if t.transaction_type == 'investment_return')
        
        # Calculate net balance
        net_balance = total_income - total_expenses
        
        # Calculate projected returns from active investments
        active_investments = [t for t in transactions if t.transaction_type == 'investment' and t.status == 'active']
        projected_returns = sum(
            t.amount * (t.roi_percentage / 100) if t.roi_percentage else 0 
            for t in active_investments
        )
        
        return jsonify({
            'summary': {
                'total_income': total_income,
                'total_expenses': total_expenses,
                'net_balance': net_balance,
                'total_loans': total_loans,
                'total_investments': total_investments,
                'total_loan_repayments': total_loan_repayments,
                'total_investment_returns': total_investment_returns,
                'projected_investment_returns': projected_returns,
                'transaction_count': len(transactions)
            },
            'period': {
                'start_date': start_date,
                'end_date': end_date
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@transactions_bp.route('/categories', methods=['GET'])
@jwt_required()
def get_categories():
    try:
        current_user_id = get_jwt_identity()
        
        if not current_user_id:
            return jsonify({'error': 'Authentication required'}), 401
        
        # Get all categories for the current user from transactions
        transactions = Transaction.query.filter_by(user_id=current_user_id).all()
        categories_set = set()
        
        for transaction in transactions:
            if transaction.category:
                categories_set.add(transaction.category)
        
        # Convert to list of category objects with default colors
        default_colors = ['#FF5722', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5', '#2196F3', '#03A9F4', '#00BCD4', '#009688', '#4CAF50']
        categories_list = []
        
        for i, category_name in enumerate(sorted(categories_set)):
            # Determine if it's an income category
            income_categories = ['Income', 'Salary', 'Investments', 'Bonus', 'Freelance']
            category_type = 'income' if category_name in income_categories else 'expense'
            
            categories_list.append({
                'name': category_name,
                'color': default_colors[i % len(default_colors)],
                'icon': 'ellipsis-horizontal',
                'type': category_type
            })
        
        # If no categories exist, return default ones
        if not categories_list:
            default_categories = [
                {'name': 'Food', 'color': '#FF5722', 'icon': 'fast-food', 'type': 'expense'},
                {'name': 'Transportation', 'color': '#2196F3', 'icon': 'car', 'type': 'expense'},
                {'name': 'Housing', 'color': '#9C27B0', 'icon': 'home', 'type': 'expense'},
                {'name': 'Entertainment', 'color': '#E91E63', 'icon': 'game-controller', 'type': 'expense'},
                {'name': 'Shopping', 'color': '#FF9800', 'icon': 'bag', 'type': 'expense'},
                {'name': 'Income', 'color': '#4CAF50', 'icon': 'cash', 'type': 'income'},
                {'name': 'Salary', 'color': '#8BC34A', 'icon': 'wallet', 'type': 'income'},
                {'name': 'Other', 'color': '#607D8B', 'icon': 'ellipsis-horizontal', 'type': 'expense'}
            ]
            categories_list = default_categories
        
        return jsonify({
            'categories': categories_list
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@transactions_bp.route('/categories', methods=['POST'])
@jwt_required()
def add_category():
    try:
        current_user_id = get_jwt_identity()
        
        if not current_user_id:
            return jsonify({'error': 'Authentication required'}), 401
            
        data = request.get_json()
        
        if not data or not data.get('name'):
            return jsonify({'error': 'Category name is required'}), 400
        
        # For now, we'll just return success since categories are inferred from transactions
        # In a more complete implementation, you might want a separate Category table
        
        return jsonify({
            'message': 'Category added successfully',
            'category': {
                'name': data['name'],
                'color': data.get('color', '#FF5722'),
                'type': data.get('type', 'expense')
            }
        }), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@transactions_bp.route('/categories/<category_name>', methods=['DELETE'])
@jwt_required()
def delete_category(category_name):
    try:
        current_user_id = get_jwt_identity()
        
        if not current_user_id:
            return jsonify({'error': 'Authentication required'}), 401
        
        # Check if category is being used in transactions
        transactions_with_category = Transaction.query.filter_by(
            user_id=current_user_id,
            category=category_name
        ).count()
        
        if transactions_with_category > 0:
            return jsonify({
                'error': f'Cannot delete category "{category_name}" as it is being used in {transactions_with_category} transaction(s)'
            }), 400
        
        return jsonify({
            'message': f'Category "{category_name}" deleted successfully'
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@transactions_bp.route('/categories/<category_name>', methods=['PUT'])
@jwt_required()
def update_category(category_name):
    try:
        current_user_id = get_jwt_identity()
        
        if not current_user_id:
            return jsonify({'error': 'Authentication required'}), 401
            
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Update all transactions with the old category name to use the new name
        if 'name' in data and data['name'] != category_name:
            transactions_to_update = Transaction.query.filter_by(
                user_id=current_user_id,
                category=category_name
            ).all()
            
            for transaction in transactions_to_update:
                transaction.category = data['name']
                transaction.updated_at = datetime.utcnow()
            
            db.session.commit()
        
        return jsonify({
            'message': 'Category updated successfully',
            'category': {
                'name': data.get('name', category_name),
                'color': data.get('color'),
                'type': data.get('type')
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
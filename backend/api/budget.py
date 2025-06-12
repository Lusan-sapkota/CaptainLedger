from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from models.models import db, Transaction  # Fix the import
from datetime import datetime

budget_bp = Blueprint('budget_api', __name__)

@budget_bp.route('/', methods=['GET'])
@jwt_required()
def get_budgets():
    try:
        current_user_id = get_jwt_identity()
        
        # Get date range from query params
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        category = request.args.get('category')
        
        # For now, we'll calculate budget dynamically from transactions
        # In the future, you can create a Budget model if needed
        
        query = Transaction.query.filter_by(user_id=current_user_id)
        
        if start_date:
            start_date_obj = datetime.strptime(start_date, '%Y-%m-%d').date()
            query = query.filter(Transaction.date >= start_date_obj)
        
        if end_date:
            end_date_obj = datetime.strptime(end_date, '%Y-%m-%d').date()
            query = query.filter(Transaction.date <= end_date_obj)
        
        if category:
            query = query.filter_by(category=category)
        
        transactions = query.all()
        
        # Group by category and calculate budgets
        category_budgets = {}
        for t in transactions:
            if t.category not in category_budgets:
                category_budgets[t.category] = {
                    'category': t.category,
                    'total_spent': 0,
                    'transaction_count': 0,
                    'avg_per_transaction': 0
                }
            
            if t.amount < 0:  # Only count expenses
                category_budgets[t.category]['total_spent'] += abs(t.amount)
            category_budgets[t.category]['transaction_count'] += 1
        
        # Calculate averages
        for category_data in category_budgets.values():
            if category_data['transaction_count'] > 0:
                category_data['avg_per_transaction'] = category_data['total_spent'] / category_data['transaction_count']
        
        return jsonify({
            'budgets': list(category_budgets.values()),
            'total_categories': len(category_budgets)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@budget_bp.route('/summary', methods=['GET'])
@jwt_required()
def get_budget_summary():
    try:
        current_user_id = get_jwt_identity()
        
        # Get current month transactions
        current_month = datetime.now().month
        current_year = datetime.now().year
        
        transactions = Transaction.query.filter_by(user_id=current_user_id).filter(
            db.extract('month', Transaction.date) == current_month,
            db.extract('year', Transaction.date) == current_year
        ).all()
        
        total_income = sum(t.amount for t in transactions if t.amount > 0)
        total_expenses = sum(abs(t.amount) for t in transactions if t.amount < 0)
        net_savings = total_income - total_expenses
        
        return jsonify({
            'summary': {
                'total_income': total_income,
                'total_expenses': total_expenses,
                'net_savings': net_savings,
                'savings_rate': (net_savings / total_income * 100) if total_income > 0 else 0
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
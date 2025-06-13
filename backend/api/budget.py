from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from models.models import db, Transaction, Budget, BudgetAlert
from datetime import datetime, timedelta
from sqlalchemy import and_, extract

budget_bp = Blueprint('budget_api', __name__)

def calculate_period_dates(period, start_date=None):
    """Calculate start and end dates for a given period"""
    if start_date is None:
        start_date = datetime.now().date()
    elif isinstance(start_date, str):
        start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
    elif isinstance(start_date, datetime):
        start_date = start_date.date()
    
    if period == 'daily':
        end_date = start_date
    elif period == 'weekly':
        # Start of week (Monday)
        days_since_monday = start_date.weekday()
        start_date = start_date - timedelta(days=days_since_monday)
        end_date = start_date + timedelta(days=6)
    elif period == 'monthly':
        # Start of month
        start_date = start_date.replace(day=1)
        # End of month
        if start_date.month == 12:
            end_date = start_date.replace(year=start_date.year + 1, month=1) - timedelta(days=1)
        else:
            end_date = start_date.replace(month=start_date.month + 1) - timedelta(days=1)
    elif period == 'yearly':
        # Start of year
        start_date = start_date.replace(month=1, day=1)
        # End of year
        end_date = start_date.replace(month=12, day=31)
    else:
        # Default to monthly
        start_date = start_date.replace(day=1)
        if start_date.month == 12:
            end_date = start_date.replace(year=start_date.year + 1, month=1) - timedelta(days=1)
        else:
            end_date = start_date.replace(month=start_date.month + 1) - timedelta(days=1)
    
    return start_date, end_date

def calculate_spent_amount(user_id, category, start_date, end_date):
    """Calculate total spent amount for a category within a date range"""
    try:
        transactions = Transaction.query.filter(
            Transaction.user_id == user_id,
            Transaction.category == category,
            Transaction.amount < 0,  # Only expenses (negative amounts)
            Transaction.date >= start_date,
            Transaction.date <= end_date
        ).all()
        
        # Return absolute value of total spent
        total_spent = sum(abs(transaction.amount) for transaction in transactions)
        return total_spent
    except Exception as e:
        print(f"Error calculating spent amount: {str(e)}")
        return 0

def get_budget_status(spent_amount, budget_amount, alert_threshold):
    """Determine budget status based on spending"""
    if budget_amount <= 0:
        return 'invalid'
    
    percentage = (spent_amount / budget_amount) * 100
    
    if percentage >= 100:
        return 'exceeded'
    elif percentage >= alert_threshold:
        return 'warning'
    elif percentage >= 50:
        return 'on_track'
    else:
        return 'healthy'

@budget_bp.route('/', methods=['GET'])
@jwt_required()
def get_budgets():
    try:
        current_user_id = get_jwt_identity()
        
        # Get query parameters
        period = request.args.get('period', 'monthly')  # daily, weekly, monthly, yearly
        category = request.args.get('category')
        active_only = request.args.get('active_only', 'true').lower() == 'true'
        
        # Build query
        query = Budget.query.filter_by(user_id=current_user_id)
        
        if period:
            query = query.filter_by(period=period)
        
        if category:
            query = query.filter_by(category=category)
            
        if active_only:
            query = query.filter_by(is_active=True)
        
        budgets = query.order_by(Budget.created_at.desc()).all()
        
        # Calculate spending for each budget
        budget_data = []
        for budget in budgets:
            # Calculate date range for current period
            start_date, end_date = calculate_period_dates(budget.period, budget.start_date)
            
            # Get transactions for this budget's category and period
            spent_amount = calculate_spent_amount(current_user_id, budget.category, start_date, end_date)
            
            # Update budget with current spent amount
            budget.spent_amount = spent_amount
            budget.remaining_amount = budget.amount - spent_amount
            
            budget_data.append({
                'id': budget.id,
                'name': budget.name,
                'category': budget.category,
                'amount': budget.amount,
                'spent_amount': spent_amount,
                'remaining_amount': budget.remaining_amount,
                'period': budget.period,
                'start_date': budget.start_date.isoformat() if budget.start_date else None,
                'end_date': budget.end_date.isoformat() if budget.end_date else None,
                'alert_threshold': budget.alert_threshold,
                'is_active': budget.is_active,
                'currency': budget.currency,
                'notes': budget.notes,
                'created_at': budget.created_at.isoformat(),
                'updated_at': budget.updated_at.isoformat(),
                'progress_percentage': (spent_amount / budget.amount * 100) if budget.amount > 0 else 0,
                'status': get_budget_status(spent_amount, budget.amount, budget.alert_threshold)
            })
        
        # Save updated spent amounts
        db.session.commit()
        
        return jsonify({
            'budgets': budget_data,
            'total_count': len(budget_data)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@budget_bp.route('/', methods=['POST'])
@jwt_required()
def create_budget():
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['name', 'category', 'amount', 'period']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        # Check for duplicate budget in same category and period
        existing_budget = Budget.query.filter_by(
            user_id=current_user_id,
            category=data['category'],
            period=data['period'],
            is_active=True
        ).first()
        
        if existing_budget:
            return jsonify({
                'error': f'An active budget already exists for {data["category"]} in {data["period"]} period'
            }), 400
        
        # Create new budget
        budget = Budget(
            user_id=current_user_id,
            name=data['name'],
            category=data['category'],
            amount=float(data['amount']),
            period=data['period'],
            start_date=datetime.strptime(data.get('start_date', datetime.now().date().isoformat()), '%Y-%m-%d').date(),
            end_date=datetime.strptime(data['end_date'], '%Y-%m-%d').date() if data.get('end_date') else None,
            currency=data.get('currency', 'USD'),
            alert_threshold=float(data.get('alert_threshold', 80.0)),
            auto_rollover=data.get('auto_rollover', False),
            notes=data.get('notes', '')
        )
        
        db.session.add(budget)
        db.session.commit()
        
        return jsonify({
            'message': 'Budget created successfully',
            'budget_id': budget.id
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@budget_bp.route('/<budget_id>', methods=['PUT'])
@jwt_required()
def update_budget(budget_id):
    try:
        current_user_id = get_jwt_identity()
        
        budget = Budget.query.filter_by(id=budget_id, user_id=current_user_id).first()
        if not budget:
            return jsonify({'error': 'Budget not found'}), 404
        
        data = request.get_json()
        
        # Update fields if provided
        if 'name' in data:
            budget.name = data['name']
        if 'category' in data:
            budget.category = data['category']
        if 'amount' in data:
            budget.amount = float(data['amount'])
        if 'period' in data:
            budget.period = data['period']
        if 'start_date' in data:
            budget.start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
        if 'end_date' in data:
            budget.end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date() if data['end_date'] else None
        if 'currency' in data:
            budget.currency = data['currency']
        if 'alert_threshold' in data:
            budget.alert_threshold = float(data['alert_threshold'])
        if 'auto_rollover' in data:
            budget.auto_rollover = data['auto_rollover']
        if 'is_active' in data:
            budget.is_active = data['is_active']
        if 'notes' in data:
            budget.notes = data['notes']
        
        budget.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({'message': 'Budget updated successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@budget_bp.route('/<budget_id>', methods=['DELETE'])
@jwt_required()
def delete_budget(budget_id):
    try:
        current_user_id = get_jwt_identity()
        
        budget = Budget.query.filter_by(id=budget_id, user_id=current_user_id).first()
        if not budget:
            return jsonify({'error': 'Budget not found'}), 404
        
        db.session.delete(budget)
        db.session.commit()
        
        return jsonify({'message': 'Budget deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
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

@budget_bp.route('/categories', methods=['GET'])
@jwt_required()
def get_budget_categories():
    """Get all unique categories that have transactions or budgets"""
    try:
        current_user_id = get_jwt_identity()
        
        # Get categories from transactions
        transaction_categories = db.session.query(Transaction.category).filter_by(
            user_id=current_user_id
        ).distinct().all()
        
        # Get categories from existing budgets
        budget_categories = db.session.query(Budget.category).filter_by(
            user_id=current_user_id
        ).distinct().all()
        
        # Combine and deduplicate
        all_categories = set()
        for cat in transaction_categories:
            if cat[0]:  # Make sure category is not None
                all_categories.add(cat[0])
        for cat in budget_categories:
            if cat[0]:  # Make sure category is not None
                all_categories.add(cat[0])
        
        # Add common budget categories if none exist
        if not all_categories:
            all_categories = {
                'Food & Dining', 'Transportation', 'Shopping', 'Entertainment',
                'Bills & Utilities', 'Healthcare', 'Travel', 'Education',
                'Personal Care', 'Gifts & Donations', 'Home & Garden', 'Other'
            }
        
        return jsonify({
            'categories': sorted(list(all_categories))
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@budget_bp.route('/<budget_id>/alerts', methods=['GET'])
@jwt_required()
def get_budget_alerts(budget_id):
    """Get alerts for a specific budget"""
    try:
        current_user_id = get_jwt_identity()
        
        budget = Budget.query.filter_by(id=budget_id, user_id=current_user_id).first()
        if not budget:
            return jsonify({'error': 'Budget not found'}), 404
        
        alerts = BudgetAlert.query.filter_by(budget_id=budget_id).order_by(
            BudgetAlert.created_at.desc()
        ).all()
        
        alert_data = []
        for alert in alerts:
            alert_data.append({
                'id': alert.id,
                'alert_type': alert.alert_type,
                'message': alert.message,
                'triggered_at': alert.triggered_at.isoformat(),
                'is_read': alert.is_read,
                'created_at': alert.created_at.isoformat()
            })
        
        return jsonify({'alerts': alert_data}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@budget_bp.route('/analytics', methods=['GET'])
@jwt_required()
def get_budget_analytics():
    """Get budget analytics and insights"""
    try:
        current_user_id = get_jwt_identity()
        
        # Get current period
        period = request.args.get('period', 'monthly')
        start_date, end_date = calculate_period_dates(period)
        
        # Get all active budgets
        budgets = Budget.query.filter_by(
            user_id=current_user_id,
            is_active=True
        ).all()
        
        analytics = {
            'period': period,
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat(),
            'total_budgeted': 0,
            'total_spent': 0,
            'categories_over_budget': 0,
            'categories_under_budget': 0,
            'budget_performance': []
        }
        
        for budget in budgets:
            spent_amount = calculate_spent_amount(
                current_user_id, budget.category, start_date, end_date
            )
            
            analytics['total_budgeted'] += budget.amount
            analytics['total_spent'] += spent_amount
            
            performance = {
                'category': budget.category,
                'budgeted': budget.amount,
                'spent': spent_amount,
                'remaining': budget.amount - spent_amount,
                'percentage': (spent_amount / budget.amount * 100) if budget.amount > 0 else 0,
                'status': get_budget_status(spent_amount, budget.amount, budget.alert_threshold)
            }
            
            if spent_amount > budget.amount:
                analytics['categories_over_budget'] += 1
            else:
                analytics['categories_under_budget'] += 1
            
            analytics['budget_performance'].append(performance)
        
        # Calculate overall performance
        analytics['overall_percentage'] = (
            analytics['total_spent'] / analytics['total_budgeted'] * 100
        ) if analytics['total_budgeted'] > 0 else 0
        
        analytics['remaining_budget'] = analytics['total_budgeted'] - analytics['total_spent']
        
        return jsonify(analytics), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@budget_bp.route('/rollover', methods=['POST'])
@jwt_required()
def rollover_budgets():
    """Rollover budgets to next period"""
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        period = data.get('period', 'monthly')
        budget_ids = data.get('budget_ids', [])
        
        if not budget_ids:
            # Get all budgets with auto_rollover enabled
            budgets = Budget.query.filter_by(
                user_id=current_user_id,
                auto_rollover=True,
                is_active=True
            ).all()
        else:
            # Get specific budgets
            budgets = Budget.query.filter(
                Budget.user_id == current_user_id,
                Budget.id.in_(budget_ids)
            ).all()
        
        rollover_count = 0
        for budget in budgets:
            # Calculate new start date
            current_start = budget.start_date
            if period == 'daily':
                new_start = current_start + timedelta(days=1)
            elif period == 'weekly':
                new_start = current_start + timedelta(weeks=1)
            elif period == 'monthly':
                if current_start.month == 12:
                    new_start = current_start.replace(year=current_start.year + 1, month=1)
                else:
                    new_start = current_start.replace(month=current_start.month + 1)
            elif period == 'yearly':
                new_start = current_start.replace(year=current_start.year + 1)
            else:
                continue
            
            # Create new budget for next period
            new_budget = Budget(
                user_id=current_user_id,
                name=budget.name,
                category=budget.category,
                amount=budget.amount,
                period=budget.period,
                start_date=new_start,
                currency=budget.currency,
                alert_threshold=budget.alert_threshold,
                auto_rollover=budget.auto_rollover,
                notes=budget.notes
            )
            
            # Deactivate old budget
            budget.is_active = False
            
            db.session.add(new_budget)
            rollover_count += 1
        
        db.session.commit()
        
        return jsonify({
            'message': f'Successfully rolled over {rollover_count} budgets',
            'rolled_over_count': rollover_count
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
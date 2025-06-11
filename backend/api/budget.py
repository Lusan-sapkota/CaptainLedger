from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..models import Budget 

budget_bp = Blueprint('budget_api', __name__)

@budget_bp.route('/', methods=['GET'])
@jwt_required()
def get_budgets():
    current_user_id = get_jwt_identity()
    # Assuming Budget is a SQLAlchemy model, it needs to be imported as well.
    budgets = Budget.query.filter_by(user_id=current_user_id).all()
    return jsonify({
        'budgets': [
            {
                'id': budget.id,
                'category': budget.category,
                'amount': budget.amount,
                'period': budget.period
            } for budget in budgets
        ]
    }), 200
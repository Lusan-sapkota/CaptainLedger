from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from models.models import db, Loan
import uuid

loans_bp = Blueprint('loans', __name__)

@loans_bp.route('/', methods=['GET'])
@jwt_required()
def get_loans():
    try:
        current_user_id = get_jwt_identity()
        
        # Get query parameters
        status = request.args.get('status')  # outstanding, paid
        loan_type = request.args.get('loan_type')  # given, taken
        
        query = Loan.query.filter_by(user_id=current_user_id)
        
        if status:
            query = query.filter_by(status=status)
        
        if loan_type:
            query = query.filter_by(loan_type=loan_type)
        
        loans = query.order_by(Loan.date.desc()).all()
        
        loans_data = []
        for loan in loans:
            loans_data.append({
                'id': loan.id,
                'loan_type': loan.loan_type,
                'amount': loan.amount,
                'currency': loan.currency,
                'contact': loan.contact,
                'status': loan.status,
                'date': loan.date.isoformat(),
                'deadline': loan.deadline.isoformat() if loan.deadline else None,
                'interest_rate': loan.interest_rate,
                'created_at': loan.created_at.isoformat() if loan.created_at else None
            })
        
        return jsonify({
            'loans': loans_data,
            'total_count': len(loans_data)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@loans_bp.route('/', methods=['POST'])
@jwt_required()
def create_loan():
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Validate required fields
        required_fields = ['loan_type', 'amount', 'date']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'{field} is required'}), 400
        
        # Parse dates
        try:
            loan_date = datetime.strptime(data['date'], '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400
        
        deadline = None
        if data.get('deadline'):
            try:
                deadline = datetime.strptime(data['deadline'], '%Y-%m-%d').date()
            except ValueError:
                return jsonify({'error': 'Invalid deadline format. Use YYYY-MM-DD'}), 400
        
        # Create loan
        loan = Loan(
            id=data.get('id', str(uuid.uuid4())),
            user_id=current_user_id,
            loan_type=data['loan_type'],
            amount=float(data['amount']),
            currency=data.get('currency', 'USD'),
            contact=data.get('contact'),
            status=data.get('status', 'outstanding'),
            date=loan_date,
            deadline=deadline,
            interest_rate=float(data['interest_rate']) if data.get('interest_rate') else None,
            is_synced=True
        )
        
        db.session.add(loan)
        db.session.commit()
        
        return jsonify({
            'message': 'Loan created successfully',
            'loan': {
                'id': loan.id,
                'loan_type': loan.loan_type,
                'amount': loan.amount,
                'currency': loan.currency,
                'contact': loan.contact,
                'status': loan.status,
                'date': loan.date.isoformat(),
                'deadline': loan.deadline.isoformat() if loan.deadline else None,
                'interest_rate': loan.interest_rate,
                'created_at': loan.created_at.isoformat()
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@loans_bp.route('/<loan_id>', methods=['PUT'])
@jwt_required()
def update_loan(loan_id):
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        loan = Loan.query.filter_by(id=loan_id, user_id=current_user_id).first()
        
        if not loan:
            return jsonify({'error': 'Loan not found'}), 404
        
        # Update fields
        if 'amount' in data:
            loan.amount = float(data['amount'])
        
        if 'currency' in data:
            loan.currency = data['currency']
        
        if 'contact' in data:
            loan.contact = data['contact']
        
        if 'status' in data:
            loan.status = data['status']
        
        if 'deadline' in data:
            if data['deadline']:
                try:
                    loan.deadline = datetime.strptime(data['deadline'], '%Y-%m-%d').date()
                except ValueError:
                    return jsonify({'error': 'Invalid deadline format. Use YYYY-MM-DD'}), 400
            else:
                loan.deadline = None
        
        if 'interest_rate' in data:
            loan.interest_rate = float(data['interest_rate']) if data['interest_rate'] else None
        
        db.session.commit()
        
        return jsonify({
            'message': 'Loan updated successfully',
            'loan': {
                'id': loan.id,
                'loan_type': loan.loan_type,
                'amount': loan.amount,
                'currency': loan.currency,
                'contact': loan.contact,
                'status': loan.status,
                'date': loan.date.isoformat(),
                'deadline': loan.deadline.isoformat() if loan.deadline else None,
                'interest_rate': loan.interest_rate
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@loans_bp.route('/<loan_id>', methods=['DELETE'])
@jwt_required()
def delete_loan(loan_id):
    try:
        current_user_id = get_jwt_identity()
        
        loan = Loan.query.filter_by(id=loan_id, user_id=current_user_id).first()
        
        if not loan:
            return jsonify({'error': 'Loan not found'}), 404
        
        db.session.delete(loan)
        db.session.commit()
        
        return jsonify({'message': 'Loan deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
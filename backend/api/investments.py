from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from models.models import db, Investment, ROIEntry
import uuid

investments_bp = Blueprint('investments', __name__)

@investments_bp.route('/', methods=['GET'])
@jwt_required()
def get_investments():
    try:
        current_user_id = get_jwt_identity()
        
        # Get query parameters
        status = request.args.get('status')  # active, matured, sold
        investment_type = request.args.get('investment_type')  # stocks, crypto, etc.
        
        query = Investment.query.filter_by(user_id=current_user_id)
        
        if status:
            query = query.filter_by(status=status)
        
        if investment_type:
            query = query.filter_by(investment_type=investment_type)
        
        investments = query.order_by(Investment.purchase_date.desc()).all()
        
        investments_data = []
        for investment in investments:
            # Calculate current ROI
            current_roi = 0
            if investment.current_value and investment.initial_amount:
                current_roi = ((investment.current_value - investment.initial_amount) / investment.initial_amount) * 100
            
            # Get latest ROI entry
            latest_roi_entry = ROIEntry.query.filter_by(investment_id=investment.id).order_by(ROIEntry.entry_date.desc()).first()
            
            investments_data.append({
                'id': investment.id,
                'name': investment.name,
                'platform': investment.platform,
                'investment_type': investment.investment_type,
                'initial_amount': investment.initial_amount,
                'current_value': investment.current_value,
                'expected_roi': investment.expected_roi,
                'actual_roi': current_roi,
                'currency': investment.currency,
                'purchase_date': investment.purchase_date.isoformat(),
                'maturity_date': investment.maturity_date.isoformat() if investment.maturity_date else None,
                'status': investment.status,
                'notes': investment.notes,
                'days_held': (datetime.now().date() - investment.purchase_date).days,
                'latest_roi_entry': {
                    'recorded_value': latest_roi_entry.recorded_value,
                    'roi_percentage': latest_roi_entry.roi_percentage,
                    'entry_date': latest_roi_entry.entry_date.isoformat(),
                    'note': latest_roi_entry.note
                } if latest_roi_entry else None,
                'created_at': investment.created_at.isoformat() if investment.created_at else None
            })
        
        return jsonify({
            'investments': investments_data,
            'total_count': len(investments_data)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@investments_bp.route('/', methods=['POST'])
@jwt_required()
def create_investment():
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Validate required fields
        required_fields = ['name', 'initial_amount', 'purchase_date']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'{field} is required'}), 400
        
        # Parse dates
        try:
            purchase_date = datetime.strptime(data['purchase_date'], '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': 'Invalid purchase_date format. Use YYYY-MM-DD'}), 400
        
        maturity_date = None
        if data.get('maturity_date'):
            try:
                maturity_date = datetime.strptime(data['maturity_date'], '%Y-%m-%d').date()
            except ValueError:
                return jsonify({'error': 'Invalid maturity_date format. Use YYYY-MM-DD'}), 400
        
        # Create investment
        investment = Investment(
            id=data.get('id', str(uuid.uuid4())),
            user_id=current_user_id,
            name=data['name'],
            platform=data.get('platform'),
            investment_type=data.get('investment_type', 'stocks'),
            initial_amount=float(data['initial_amount']),
            current_value=float(data.get('current_value', data['initial_amount'])),
            expected_roi=float(data['expected_roi']) if data.get('expected_roi') else None,
            currency=data.get('currency', 'USD'),
            purchase_date=purchase_date,
            maturity_date=maturity_date,
            status=data.get('status', 'active'),
            notes=data.get('notes')
        )
        
        db.session.add(investment)
        
        # Create initial ROI entry
        initial_roi_entry = ROIEntry(
            id=str(uuid.uuid4()),
            investment_id=investment.id,
            recorded_value=investment.initial_amount,
            roi_percentage=0.0,
            entry_date=purchase_date,
            note='Initial investment'
        )
        
        db.session.add(initial_roi_entry)
        db.session.commit()
        
        return jsonify({
            'message': 'Investment created successfully',
            'investment': {
                'id': investment.id,
                'name': investment.name,
                'platform': investment.platform,
                'investment_type': investment.investment_type,
                'initial_amount': investment.initial_amount,
                'current_value': investment.current_value,
                'expected_roi': investment.expected_roi,
                'currency': investment.currency,
                'purchase_date': investment.purchase_date.isoformat(),
                'maturity_date': investment.maturity_date.isoformat() if investment.maturity_date else None,
                'status': investment.status,
                'notes': investment.notes,
                'created_at': investment.created_at.isoformat()
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@investments_bp.route('/<investment_id>/roi', methods=['POST'])
@jwt_required()
def add_roi_entry(investment_id):
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Verify investment ownership
        investment = Investment.query.filter_by(id=investment_id, user_id=current_user_id).first()
        if not investment:
            return jsonify({'error': 'Investment not found'}), 404
        
        # Validate required fields
        required_fields = ['recorded_value', 'entry_date']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'{field} is required'}), 400
        
        # Parse date
        try:
            entry_date = datetime.strptime(data['entry_date'], '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': 'Invalid entry_date format. Use YYYY-MM-DD'}), 400
        
        # Calculate ROI
        recorded_value = float(data['recorded_value'])
        roi_percentage = ((recorded_value - investment.initial_amount) / investment.initial_amount) * 100
        
        # Create ROI entry
        roi_entry = ROIEntry(
            id=str(uuid.uuid4()),
            investment_id=investment_id,
            recorded_value=recorded_value,
            roi_percentage=roi_percentage,
            entry_date=entry_date,
            note=data.get('note')
        )
        
        # Update investment current value and actual ROI
        investment.current_value = recorded_value
        investment.actual_roi = roi_percentage
        investment.updated_at = datetime.utcnow()
        
        db.session.add(roi_entry)
        db.session.commit()
        
        return jsonify({
            'message': 'ROI entry added successfully',
            'roi_entry': {
                'id': roi_entry.id,
                'recorded_value': roi_entry.recorded_value,
                'roi_percentage': roi_entry.roi_percentage,
                'entry_date': roi_entry.entry_date.isoformat(),
                'note': roi_entry.note,
                'created_at': roi_entry.created_at.isoformat()
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@investments_bp.route('/<investment_id>/roi', methods=['GET'])
@jwt_required()
def get_roi_history(investment_id):
    try:
        current_user_id = get_jwt_identity()
        
        # Verify investment ownership
        investment = Investment.query.filter_by(id=investment_id, user_id=current_user_id).first()
        if not investment:
            return jsonify({'error': 'Investment not found'}), 404
        
        roi_entries = ROIEntry.query.filter_by(investment_id=investment_id).order_by(ROIEntry.entry_date.desc()).all()
        
        roi_data = []
        for entry in roi_entries:
            roi_data.append({
                'id': entry.id,
                'recorded_value': entry.recorded_value,
                'roi_percentage': entry.roi_percentage,
                'entry_date': entry.entry_date.isoformat(),
                'note': entry.note,
                'created_at': entry.created_at.isoformat()
            })
        
        return jsonify({
            'roi_history': roi_data,
            'investment_name': investment.name,
            'total_entries': len(roi_data)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@investments_bp.route('/analytics', methods=['GET'])
@jwt_required()
def get_investment_analytics():
    try:
        current_user_id = get_jwt_identity()
        
        investments = Investment.query.filter_by(user_id=current_user_id).all()
        
        total_invested = sum(inv.initial_amount for inv in investments)
        total_current_value = sum(inv.current_value or inv.initial_amount for inv in investments)
        total_roi = ((total_current_value - total_invested) / total_invested * 100) if total_invested > 0 else 0
        
        # Group by investment type
        by_type = {}
        for inv in investments:
            inv_type = inv.investment_type or 'Unknown'
            if inv_type not in by_type:
                by_type[inv_type] = {
                    'count': 0,
                    'total_invested': 0,
                    'total_current_value': 0,
                    'avg_roi': 0
                }
            
            by_type[inv_type]['count'] += 1
            by_type[inv_type]['total_invested'] += inv.initial_amount
            by_type[inv_type]['total_current_value'] += inv.current_value or inv.initial_amount
        
        # Calculate ROI for each type
        for type_data in by_type.values():
            if type_data['total_invested'] > 0:
                type_data['avg_roi'] = ((type_data['total_current_value'] - type_data['total_invested']) / type_data['total_invested']) * 100
        
        # Best and worst performers
        best_performer = max(investments, key=lambda x: x.actual_roi or 0) if investments else None
        worst_performer = min(investments, key=lambda x: x.actual_roi or 0) if investments else None
        
        return jsonify({
            'analytics': {
                'total_investments': len(investments),
                'total_invested': total_invested,
                'total_current_value': total_current_value,
                'total_roi_percentage': total_roi,
                'total_gain_loss': total_current_value - total_invested,
                'by_investment_type': by_type,
                'best_performer': {
                    'name': best_performer.name,
                    'roi': best_performer.actual_roi
                } if best_performer else None,
                'worst_performer': {
                    'name': worst_performer.name,
                    'roi': worst_performer.actual_roi
                } if worst_performer else None
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@investments_bp.route('/<investment_id>', methods=['PUT'])
@jwt_required()
def update_investment(investment_id):
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        investment = Investment.query.filter_by(id=investment_id, user_id=current_user_id).first()
        
        if not investment:
            return jsonify({'error': 'Investment not found'}), 404
        
        # Update fields
        if 'name' in data:
            investment.name = data['name']
        
        if 'platform' in data:
            investment.platform = data['platform']
        
        if 'investment_type' in data:
            investment.investment_type = data['investment_type']
        
        if 'current_value' in data:
            investment.current_value = float(data['current_value'])
            # Recalculate actual ROI
            if investment.initial_amount:
                investment.actual_roi = ((investment.current_value - investment.initial_amount) / investment.initial_amount) * 100
        
        if 'expected_roi' in data:
            investment.expected_roi = float(data['expected_roi']) if data['expected_roi'] else None
        
        if 'status' in data:
            investment.status = data['status']
        
        if 'notes' in data:
            investment.notes = data['notes']
        
        if 'maturity_date' in data:
            if data['maturity_date']:
                try:
                    investment.maturity_date = datetime.strptime(data['maturity_date'], '%Y-%m-%d').date()
                except ValueError:
                    return jsonify({'error': 'Invalid maturity_date format. Use YYYY-MM-DD'}), 400
            else:
                investment.maturity_date = None
        
        investment.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Investment updated successfully',
            'investment': {
                'id': investment.id,
                'name': investment.name,
                'platform': investment.platform,
                'investment_type': investment.investment_type,
                'initial_amount': investment.initial_amount,
                'current_value': investment.current_value,
                'expected_roi': investment.expected_roi,
                'actual_roi': investment.actual_roi,
                'currency': investment.currency,
                'purchase_date': investment.purchase_date.isoformat(),
                'maturity_date': investment.maturity_date.isoformat() if investment.maturity_date else None,
                'status': investment.status,
                'notes': investment.notes,
                'updated_at': investment.updated_at.isoformat()
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@investments_bp.route('/<investment_id>', methods=['DELETE'])
@jwt_required()
def delete_investment(investment_id):
    try:
        current_user_id = get_jwt_identity()
        
        investment = Investment.query.filter_by(id=investment_id, user_id=current_user_id).first()
        
        if not investment:
            return jsonify({'error': 'Investment not found'}), 404
        
        db.session.delete(investment)
        db.session.commit()
        
        return jsonify({'message': 'Investment deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
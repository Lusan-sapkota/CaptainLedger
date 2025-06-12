from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from models.models import db, Currency, ExchangeRate, CurrencyPreference
from datetime import datetime

currencies_bp = Blueprint('currencies', __name__)

@currencies_bp.route('/', methods=['GET'])
def get_currencies():
    """Get all available currencies"""
    try:
        currencies = Currency.query.filter_by(is_active=True).all()
        return jsonify({
            'currencies': [{
                'id': currency.id,
                'code': currency.code,
                'name': currency.name,
                'symbol': currency.symbol,
                'country': currency.country,
                'decimal_places': currency.decimal_places,
                'is_active': currency.is_active
            } for currency in currencies]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@currencies_bp.route('/preferences', methods=['GET'])
@jwt_required()
def get_currency_preferences():
    """Get user's currency preferences"""
    try:
        user_id = get_jwt_identity()
        preferences = CurrencyPreference.query.filter_by(user_id=user_id).all()
        
        return jsonify({
            'preferences': [{
                'id': pref.id,
                'currency_code': pref.currency_code,
                'is_primary': pref.is_primary,
                'display_order': pref.display_order
            } for pref in preferences]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@currencies_bp.route('/preferences', methods=['POST'])
@jwt_required()
def set_currency_preference():
    """Set user's currency preference"""
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        currency_code = data.get('currency_code')
        is_primary = data.get('is_primary', False)
        
        if not currency_code:
            return jsonify({'error': 'Currency code is required'}), 400
        
        # If setting as primary, remove primary from other preferences
        if is_primary:
            existing_primary = CurrencyPreference.query.filter_by(
                user_id=user_id, is_primary=True
            ).first()
            if existing_primary:
                existing_primary.is_primary = False
        
        # Check if preference already exists
        existing_pref = CurrencyPreference.query.filter_by(
            user_id=user_id, currency_code=currency_code
        ).first()
        
        if existing_pref:
            existing_pref.is_primary = is_primary
        else:
            new_pref = CurrencyPreference(
                user_id=user_id,
                currency_code=currency_code,
                is_primary=is_primary,
                display_order=0
            )
            db.session.add(new_pref)
        
        db.session.commit()
        return jsonify({'message': 'Currency preference updated successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@currencies_bp.route('/exchange-rate', methods=['GET'])
def get_exchange_rate():
    """Get exchange rate between two currencies"""
    try:
        from_currency = request.args.get('from')
        to_currency = request.args.get('to')
        
        if not from_currency or not to_currency:
            return jsonify({'error': 'Both from and to currencies are required'}), 400
        
        if from_currency == to_currency:
            return jsonify({'rate': 1.0}), 200
        
        # Try to get from database first
        exchange_rate = ExchangeRate.query.filter_by(
            from_currency=from_currency,
            to_currency=to_currency,
            date=datetime.now().date()
        ).first()
        
        if exchange_rate:
            return jsonify({'rate': exchange_rate.rate}), 200
        
        # If not found, return a default rate (in production, you'd fetch from an API)
        # For now, return 1.0 as fallback
        default_rate = 1.0
        
        # You can implement actual exchange rate fetching here
        # For example, using an external API like exchangerate-api.com
        
        return jsonify({'rate': default_rate}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
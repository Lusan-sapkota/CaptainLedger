from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from models.models import db, Currency, ExchangeRate, CurrencyPreference
from services.exchange_rate_service import exchange_rate_service
from datetime import datetime
import requests
import os

currencies_bp = Blueprint('currencies', __name__)

@currencies_bp.route('/', methods=['GET'])
def get_currencies():
    """Get all available currencies"""
    try:
        currencies = Currency.query.filter_by(is_active=True).order_by(Currency.code).all()
        return jsonify({
            'currencies': [{
                'id': currency.id,
                'code': currency.code,
                'name': currency.name,
                'symbol': currency.symbol,
                'country': currency.country,
                'decimal_places': currency.decimal_places,
                'is_active': currency.is_active
            } for currency in currencies],
            'count': len(currencies)
        }), 200
    except Exception as e:
        print(f"Error fetching currencies: {str(e)}")
        return jsonify({'error': 'Failed to fetch currencies'}), 500

@currencies_bp.route('/preferences', methods=['GET'])
@jwt_required()
def get_currency_preferences():
    """Get user's currency preferences"""
    try:
        user_id = get_jwt_identity()
        preferences = CurrencyPreference.query.filter_by(user_id=user_id).order_by(CurrencyPreference.display_order).all()
        
        # If no preferences found, create a default USD preference
        if not preferences:
            default_pref = CurrencyPreference(
                user_id=user_id,
                currency_code='USD',
                is_primary=True,
                display_order=0
            )
            db.session.add(default_pref)
            db.session.commit()
            preferences = [default_pref]
        
        return jsonify({
            'preferences': [{
                'id': pref.id,
                'currency_code': pref.currency_code,
                'is_primary': pref.is_primary,
                'display_order': pref.display_order
            } for pref in preferences]
        }), 200
    except Exception as e:
        print(f"Error fetching currency preferences: {str(e)}")
        return jsonify({'error': 'Failed to fetch currency preferences'}), 500

@currencies_bp.route('/preferences', methods=['POST'])
@jwt_required()
def set_currency_preference():
    """Set user's currency preference"""
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Handle both old format (currency_code) and new format (primary_currency)
        currency_code = data.get('primary_currency') or data.get('currency_code')
        is_primary = data.get('is_primary', True)  # Default to primary
        
        if not currency_code:
            return jsonify({'error': 'Primary currency is required'}), 400
        
        # Validate currency exists
        currency = Currency.query.filter_by(code=currency_code, is_active=True).first()
        if not currency:
            return jsonify({'error': f'Invalid currency code: {currency_code}'}), 400
        
        # Clear existing primary preference
        existing_primary = CurrencyPreference.query.filter_by(
            user_id=user_id, 
            is_primary=True
        ).first()
        
        if existing_primary:
            existing_primary.is_primary = False
        
        # Set new primary preference
        new_preference = CurrencyPreference.query.filter_by(
            user_id=user_id,
            currency_code=currency_code
        ).first()
        
        if new_preference:
            new_preference.is_primary = True
        else:
            new_preference = CurrencyPreference(
                user_id=user_id,
                currency_code=currency_code,
                is_primary=True,
                display_order=0
            )
            db.session.add(new_preference)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Currency preference updated successfully',
            'primary_currency': currency_code,
            'currency_details': {
                'code': currency.code,
                'name': currency.name,
                'symbol': currency.symbol,
                'decimal_places': currency.decimal_places
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error setting currency preference: {str(e)}")
        return jsonify({'error': 'Failed to set currency preference'}), 500

@currencies_bp.route('/exchange-rate', methods=['GET'])
def get_exchange_rate():
    """Get exchange rate between two currencies"""
    try:
        from_currency = request.args.get('from')
        to_currency = request.args.get('to')
        
        if not from_currency or not to_currency:
            return jsonify({'error': 'Both from and to currencies are required'}), 400
        
        if from_currency == to_currency:
            return jsonify({
                'rate': 1.0, 
                'source': 'same_currency',
                'timestamp': datetime.utcnow().isoformat()
            }), 200
        
        # Use the exchange rate service
        rate = exchange_rate_service.get_exchange_rate(from_currency, to_currency)
        
        if rate is None:
            return jsonify({'error': 'Exchange rate not available'}), 404
        
        return jsonify({
            'rate': rate,
            'from_currency': from_currency,
            'to_currency': to_currency,
            'timestamp': datetime.utcnow().isoformat()
        }), 200
        
    except Exception as e:
        print(f"Error fetching exchange rate: {str(e)}")
        return jsonify({'error': 'Failed to fetch exchange rate'}), 500

@currencies_bp.route('/convert-bulk', methods=['POST'])
@jwt_required()
def convert_bulk_currency():
    """Convert multiple currency amounts in bulk for efficient processing"""
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        conversions = data.get('conversions', [])
        if not conversions:
            return jsonify({'error': 'No conversions requested'}), 400
        
        results = []
        successful_conversions = 0
        
        for conversion in conversions:
            try:
                amount = float(conversion.get('amount', 0))
                from_currency = conversion.get('from_currency')
                to_currency = conversion.get('to_currency')
                item_id = conversion.get('item_id')  # For tracking which item this is for
                item_type = conversion.get('item_type', 'unknown')  # transaction, budget, loan, etc.
                
                if not from_currency or not to_currency:
                    results.append({
                        'item_id': item_id,
                        'item_type': item_type,
                        'success': False,
                        'error': 'Missing currency codes'
                    })
                    continue
                
                if from_currency == to_currency:
                    # No conversion needed
                    results.append({
                        'item_id': item_id,
                        'item_type': item_type,
                        'success': True,
                        'original_amount': amount,
                        'converted_amount': amount,
                        'from_currency': from_currency,
                        'to_currency': to_currency,
                        'exchange_rate': 1.0,
                        'rate_source': 'same_currency'
                    })
                    successful_conversions += 1
                    continue
                
                # Get exchange rate
                rate = exchange_rate_service.get_exchange_rate(from_currency, to_currency)
                
                if rate is not None:
                    converted_amount = amount * rate
                    results.append({
                        'item_id': item_id,
                        'item_type': item_type,
                        'success': True,
                        'original_amount': amount,
                        'converted_amount': converted_amount,
                        'from_currency': from_currency,
                        'to_currency': to_currency,
                        'exchange_rate': rate,
                        'rate_source': 'exchange_service'
                    })
                    successful_conversions += 1
                else:
                    results.append({
                        'item_id': item_id,
                        'item_type': item_type,
                        'success': False,
                        'error': 'Exchange rate not available'
                    })
                    
            except ValueError as e:
                results.append({
                    'item_id': conversion.get('item_id'),
                    'item_type': conversion.get('item_type', 'unknown'),
                    'success': False,
                    'error': f'Invalid amount: {str(e)}'
                })
            except Exception as e:
                results.append({
                    'item_id': conversion.get('item_id'),
                    'item_type': conversion.get('item_type', 'unknown'),
                    'success': False,
                    'error': str(e)
                })
        
        return jsonify({
            'conversions': results,
            'total_requested': len(conversions),
            'successful': successful_conversions,
            'failed': len(conversions) - successful_conversions,
            'timestamp': datetime.utcnow().isoformat()
        }), 200
        
    except Exception as e:
        print(f"Error in bulk currency conversion: {str(e)}")
        return jsonify({'error': 'Failed to process bulk conversion'}), 500

@currencies_bp.route('/supported', methods=['GET'])
def get_supported_currencies():
    """Get list of supported currencies for exchange"""
    try:
        supported = exchange_rate_service.get_supported_currencies()
        return jsonify(supported), 200
    except Exception as e:
        print(f"Error fetching supported currencies: {str(e)}")
        return jsonify({'error': 'Failed to fetch supported currencies'}), 500
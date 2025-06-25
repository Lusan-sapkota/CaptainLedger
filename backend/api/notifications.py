from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from models.models import db, User, Notification, CurrencyPreference, Transaction
from websocket.socket_server import send_notification, send_system_message
from datetime import datetime, timedelta
import json
from utils.email_service import email_service

notifications_bp = Blueprint('notifications_api', __name__)

@notifications_bp.route('/', methods=['GET'])
@jwt_required()
def get_notifications():
    """Get user notifications"""
    user_id = get_jwt_identity()
    
    # Get notifications from database
    notifications = Notification.query.filter_by(
        user_id=user_id
    ).order_by(
        Notification.created_at.desc()
    ).limit(100).all()
    
    return jsonify({
        'notifications': [
            {
                'id': str(n.id),
                'type': n.type,
                'title': n.title,
                'message': n.message,
                'data': json.loads(n.data) if n.data else {},
                'read': n.is_read,
                'date': n.created_at.isoformat()
            } for n in notifications
        ]
    })

@notifications_bp.route('/', methods=['POST'])
@jwt_required()
def create_notification():
    """Create a new notification"""
    user_id = get_jwt_identity()
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
        
    # Create notification record
    notification = Notification(
        user_id=user_id,
        type=data.get('type', 'system'),
        title=data.get('title', 'Notification'),
        message=data.get('message', ''),
        data=json.dumps(data.get('data', {})),
        is_read=False
    )
    
    db.session.add(notification)
    db.session.commit()
    
    # Send real-time notification
    send_notification(user_id, notification.type, {
        'id': str(notification.id),
        'title': notification.title,
        'message': notification.message,
        'data': json.loads(notification.data) if notification.data else {},
        'timestamp': notification.created_at.isoformat(),
        'read': notification.is_read
    })
    
    return jsonify({
        'id': str(notification.id),
        'message': 'Notification created successfully'
    })

@notifications_bp.route('/<notification_id>/read', methods=['PUT'])
@jwt_required()
def mark_notification_read(notification_id):
    """Mark a notification as read"""
    user_id = get_jwt_identity()
    
    notification = Notification.query.filter_by(
        id=notification_id,
        user_id=user_id
    ).first()
    
    if not notification:
        return jsonify({'error': 'Notification not found'}), 404
    
    notification.is_read = True
    db.session.commit()
    
    return jsonify({'message': 'Notification marked as read'})

@notifications_bp.route('/email', methods=['POST'])
@jwt_required()
def send_email_notification():
    """Send an email notification with strict rate limiting"""
    
    user_id = get_jwt_identity()
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Extract email type (budget_alert, weekly_report, etc.)
    email_type = data.get('type', 'general')
    
    # Apply strict rate limiting based on email type - uses email_service internal limits
    if not email_service.can_send_email(user_id, email_type):
        wait_time = {
            'budget_alert': '24 hours',
            'weekly_report': '7 days',
            'monthly_report': '30 days',
            'loan_reminder': '48 hours',
            'general': '12 hours'
        }.get(email_type, '24 hours')
        
        return jsonify({
            'error': f'Rate limit exceeded. You can only send one {email_type.replace("_", " ")} every {wait_time}.',
            'rate_limited': True
        }), 429
    
    try:
        # Special handling for different email types
        if email_type == 'budget_alert':
            budget_percent = data.get('budget_percent', 80)
            user_currency = get_user_currency(user_id)
            success = email_service.send_budget_alert(user.email, user.fullName or user.email.split('@')[0], budget_percent, user_currency)
        
        elif email_type == 'weekly_report':
            # Get transactions for the past week
            end_date = datetime.now()
            start_date = end_date - timedelta(days=7)
            
            transactions = get_user_transactions(user_id, start_date, end_date)
            user_currency = get_user_currency(user_id)
            
            success = email_service.send_weekly_report(user.email, user.fullName or user.email.split('@')[0], transactions, user_currency)
        
        elif email_type == 'monthly_report':
            # Get transactions for the past month
            end_date = datetime.now()
            start_date = end_date - timedelta(days=30)
            
            transactions = get_user_transactions(user_id, start_date, end_date)
            user_currency = get_user_currency(user_id)
            
            success = email_service.send_monthly_report(user.email, user.fullName or user.email.split('@')[0], transactions, user_currency)
        
        else:
            # General email
            subject = data.get('subject', 'Notification from CaptainLedger')
            message = data.get('message', 'This is a notification from CaptainLedger.')
            
            html_body = f"""
            <html>
            <body>
                <h2>Hello {user.fullName or user.email.split('@')[0]},</h2>
                <p>{message}</p>
                <p>Best regards,<br>
                The CaptainLedger Team</p>
            </body>
            </html>
            """
            
            success = email_service.send_generic_email(user.email, subject, html_body)
            if success:
                email_service.record_email_sent(user_id, 'general', subject, message[:100])
        
        if success:
            return jsonify({'success': True, 'message': 'Email sent successfully'}), 200
        else:
            return jsonify({'error': 'Failed to send email, please try again later'}), 500
            
    except Exception as e:
        current_app.logger.error(f"Error sending email notification: {e}")
        return jsonify({'error': f'Error sending email: {str(e)}'}), 500

# Helper function to get user transactions
def get_user_transactions(user_id, start_date, end_date):
    transactions = Transaction.query.filter(
        Transaction.user_id == user_id,
        Transaction.date >= start_date.date(),
        Transaction.date <= end_date.date()
    ).all()
    
    transaction_dicts = []
    user_currency = get_user_currency(user_id)
    
    for t in transactions:
        transaction_dicts.append({
            'id': t.id,
            'amount': t.amount,
            'date': t.date.isoformat(),
            'category': t.category,
            'note': t.note,
            'currency': t.currency or user_currency
        })
    
    return transaction_dicts

# Helper function to get user currency
def get_user_currency(user_id):
    currency_pref = CurrencyPreference.query.filter_by(user_id=user_id).first()
    return currency_pref.currency_code if currency_pref else 'USD'
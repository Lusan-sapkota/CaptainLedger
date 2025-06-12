from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from models.models import db, User, Notification
from websocket.socket_server import send_notification, send_system_message
from datetime import datetime

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
                'data': n.data,
                'read': n.read,
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
        data=data.get('data', {}),
        read=False
    )
    
    db.session.add(notification)
    db.session.commit()
    
    # Send real-time notification
    send_notification(user_id, notification.type, {
        'id': str(notification.id),
        'title': notification.title,
        'message': notification.message,
        'data': notification.data,
        'timestamp': notification.created_at.isoformat(),
        'read': notification.read
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
    
    notification.read = True
    db.session.commit()
    
    return jsonify({'message': 'Notification marked as read'})

@notifications_bp.route('/email', methods=['POST'])
@jwt_required()
def send_email_notification():
    """Send an email notification"""
    from utils.email import email_service
    
    user_id = get_jwt_identity()
    data = request.get_json()
    
    if not data or 'type' not in data or 'data' not in data:
        return jsonify({'error': 'Invalid request data'}), 400
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
        
    try:
        notification_type = data['type']
        notification_data = data['data']
        
        if notification_type == 'weekly_report':
            email_service.send_weekly_report(
                user.email,
                user.fullName,
                notification_data.get('transactions', [])
            )
            
        elif notification_type == 'monthly_report':
            email_service.send_monthly_report(
                user.email,
                user.fullName,
                notification_data.get('transactions', []),
                notification_data.get('month', 'Monthly')
            )
            
        elif notification_type == 'budget_alert':
            # Create custom budget alert email
            # Implementation would depend on your email service capabilities
            pass
            
        elif notification_type == 'loan_reminder':
            # Create custom loan reminder email
            # Implementation would depend on your email service capabilities
            pass
            
        return jsonify({'message': 'Email notification sent successfully'})
        
    except Exception as e:
        return jsonify({'error': f'Failed to send email: {str(e)}'}), 500
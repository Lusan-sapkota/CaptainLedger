import json
from flask import current_app, request
from flask_socketio import SocketIO, emit, join_room, leave_room, disconnect
from flask_jwt_extended import decode_token
from jwt.exceptions import PyJWTError
import functools
import datetime

socketio = SocketIO()

# Store active clients
clients = {}

def authenticated_only(f):
    @functools.wraps(f)
    def wrapped(*args, **kwargs):
        if not request.args.get('token'):
            disconnect()
            return
        
        try:
            # Verify the token
            token = request.args.get('token')
            user_data = decode_token(token)
            user_id = user_data['sub']
            
            # Associate user with their socket ID
            if request.sid:
                clients[request.sid] = user_id
            
            return f(*args, **kwargs)
        except PyJWTError:
            disconnect()
            
    return wrapped

def init_app(app):
    """Initialize socket.io with the Flask app"""
    socketio.init_app(app, cors_allowed_origins="*")
    app.logger.info("WebSocket server initialized")
    
    @socketio.on('connect')
    @authenticated_only
    def handle_connect():
        user_id = request.args.get('user_id')
        if user_id:
            # Add this socket to the user's room
            join_room(user_id)
            current_app.logger.info(f"User {user_id} connected on socket {request.sid}")
            
            # Send welcome notification
            emit('message', {
                'type': 'system_message',
                'payload': {
                    'title': 'Connected',
                    'message': 'You are now connected to real-time updates'
                }
            })

    @socketio.on('disconnect')
    def handle_disconnect():
        if request.sid in clients:
            user_id = clients[request.sid]
            current_app.logger.info(f"User {user_id} disconnected")
            del clients[request.sid]

    @socketio.on('ping')
    @authenticated_only
    def handle_ping():
        emit('pong', {'timestamp': datetime.now().isoformat()})

    return socketio

def send_notification(user_id, notification_type, data):
    """Send a notification to a specific user"""
    try:
        socketio.emit('message', {
            'type': notification_type,
            'payload': data
        }, room=user_id)
        current_app.logger.debug(f"Notification sent to user {user_id}")
        return True
    except Exception as e:
        current_app.logger.error(f"Error sending notification: {e}")
        return False

def send_transaction_update(user_id, transaction):
    """Send transaction update notification"""
    send_notification(user_id, 'transaction_update', transaction)

def send_budget_alert(user_id, alert_data):
    """Send budget alert notification"""
    send_notification(user_id, 'budget_alert', {
        'title': 'Budget Alert',
        'message': alert_data.get('message', 'You are approaching your budget limit'),
        'data': alert_data
    })

def send_loan_reminder(user_id, loan_data):
    """Send loan reminder notification"""
    send_notification(user_id, 'loan_reminder', {
        'title': 'Loan Payment Due',
        'message': f"Your loan payment of {loan_data.get('amount', 0)} is due soon",
        'data': loan_data
    })

def send_system_message(user_id, title, message, additional_data=None):
    """Send system message notification"""
    data = {
        'title': title,
        'message': message
    }
    if additional_data:
        data.update(additional_data)
    
    send_notification(user_id, 'system_message', data)
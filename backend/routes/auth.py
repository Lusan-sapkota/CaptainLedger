from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from models.models import db, User
from utils.email import email_service
import random
from datetime import datetime, timedelta

# Change the name to avoid conflicts
auth_bp = Blueprint('routes_auth', __name__)

# Store OTPs in memory (in production, use Redis or DB)
otp_store = {}  # {email: {'otp': '123456', 'expires': datetime}}

# Add a dictionary to store trusted devices
# In a production environment, this should be stored in a database
trusted_devices = {}

def generate_otp():
    """Generate a 6-digit OTP"""
    return ''.join([str(random.randint(0, 9)) for _ in range(6)])

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Email and password are required'}), 400
    
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Email already registered'}), 409
    
    # Generate OTP
    otp = generate_otp()
    
    # Store OTP and user data
    otp_store[data['email']] = {
        'otp': otp,
        'expires': datetime.utcnow() + timedelta(minutes=10),
        'user_data': {
            'email': data['email'],
            'password': data['password'],
            'fullName': data.get('fullName', ''),
            'country': data.get('country', 'Nepal')
        }
    }
    
    # Send OTP email
    email_service.send_otp_email(
        data['email'], 
        otp,
        name=data.get('fullName', '')
    )
    
    return jsonify({
        'message': 'Registration initiated. Please check your email for OTP.',
        'email': data['email']
    }), 201

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Email and password are required'}), 400
    
    user = User.query.filter_by(email=data['email']).first()
    
    if not user or not check_password_hash(user.password_hash, data['password']):
        return jsonify({'error': 'Invalid credentials'}), 401
    
    # Check if login is from a trusted device
    device_id = data.get('deviceId')
    is_trusted_device = False
    
    if device_id and user.id in trusted_devices:
        trusted_device_ids = [d['id'] for d in trusted_devices[user.id]]
        is_trusted_device = device_id in trusted_device_ids
    
    # Only send login notification for non-trusted devices
    if not is_trusted_device:
        email_service.send_login_notification(
            user.email, 
            device_info=request.headers.get('User-Agent', 'Unknown device')
        )
    
    access_token = create_access_token(identity=user.id)
    
    return jsonify({
        'message': 'Login successful',
        'user': {
            'id': user.id,
            'email': user.email
        },
        'token': access_token,
        'is_trusted_device': is_trusted_device
    })

@auth_bp.route('/profile', methods=['GET'])
@jwt_required()
def profile():
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Get additional profile info from user if available
    # or provide default values for compatibility with frontend
    user_data = {
        'id': user.id,
        'email': user.email,
        'created_at': user.created_at,
        'last_sync': user.last_sync,
        'fullName': getattr(user, 'fullName', None) or user.email.split('@')[0],
        'country': getattr(user, 'country', 'Nepal')  # Default value
    }
    
    return jsonify(user_data)

@auth_bp.route('/verify-otp', methods=['POST'])
def verify_otp():
    data = request.get_json()
    email = data.get('email')
    otp = data.get('otp')
    
    if not email or not otp:
        return jsonify({'error': 'Email and OTP are required'}), 400
    
    # Check if OTP exists and is valid
    stored_data = otp_store.get(email)
    if not stored_data:
        return jsonify({
            'success': False,
            'message': 'OTP expired or not found. Please request a new code.'
        }), 400
    
    if datetime.utcnow() > stored_data['expires']:
        # OTP expired
        otp_store.pop(email, None)
        return jsonify({
            'success': False, 
            'message': 'OTP expired. Please request a new code.'
        }), 400
    
    if otp != stored_data['otp']:
        return jsonify({
            'success': False,
            'message': 'Invalid verification code.'
        }), 400
    
    # OTP is valid - create user
    try:
        user_data = stored_data['user_data']
        
        user = User(
            email=user_data['email'],
            password_hash=generate_password_hash(user_data['password']),
            fullName=user_data.get('fullName'),
            country=user_data.get('country', 'Nepal'),
            email_verified=True,
            email_verified_at=datetime.utcnow()
        )
        
        db.session.add(user)
        db.session.commit()
        
        # Clear OTP from store
        otp_store.pop(email, None)
        
        # Generate JWT token
        access_token = create_access_token(identity=user.id)
        
        # Send welcome email
        email_service.send_welcome_email(user.email, name=user.fullName)
        
        return jsonify({
            'success': True,
            'token': access_token,
            'user': {
                'id': user.id,
                'email': user.email,
                'full_name': user.fullName,
                'country': user.country
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        print(f"Database error during user creation: {e}")
        return jsonify({
            'success': False,
            'message': 'An error occurred while creating your account.'
        }), 500

# Add this route to handle OTP resending

@auth_bp.route('/resend-otp', methods=['POST'])
def resend_otp():
    data = request.get_json()
    email = data.get('email')
    
    if not email:
        return jsonify({'error': 'Email is required'}), 400
    
    # Check if user exists or if OTP is already stored
    try:
        user_exists = User.query.filter_by(email=email).first()
        otp_data = otp_store.get(email)
        
        # If neither user nor OTP exists, user hasn't started signup
        if not user_exists and not otp_data:
            return jsonify({
                'success': False,
                'message': 'No registration found for this email. Please sign up first.'
            }), 400
    except Exception as e:
        print(f"Database error during OTP resend: {e}")
        return jsonify({
            'success': False,
            'message': 'An error occurred. Please try again later.'
        }), 500
    
    # Generate new OTP
    new_otp = generate_otp()
    
    # Get user data if it exists
    user_data = None
    if email in otp_store and 'user_data' in otp_store[email]:
        user_data = otp_store[email]['user_data']
    
    # Update OTP data
    otp_store[email] = {
        'otp': new_otp,
        'expires': datetime.utcnow() + timedelta(minutes=15),  # OTP valid for 15 minutes
        'user_data': user_data  # Keep user data if it exists
    }
    
    # Send OTP email
    name = user_data.get('fullName', '') if user_data else ''
    
    # Uncomment this to send actual email
    email_sent = email_service.send_otp_email(email, new_otp, name)
    
    if email_sent:
        return jsonify({
            'success': True,
            'message': 'Verification code sent to your email'
        }), 200
    else:
        # For development, return OTP
        print(f"OTP for {email}: {new_otp}")
        return jsonify({
            'success': True,
            'message': 'Verification code sent (check console for development)',
            'dev_otp': new_otp  # Only include in development
        }), 200

# Add this route at the end of your file

@auth_bp.route('/db-status', methods=['GET'])
def db_status():
    """Check database connection status"""
    try:
        # Try to query something simple
        user_count = User.query.count()
        
        # If no error, return success
        return jsonify({
            'success': True,
            'status': 'connected',
            'database': db.engine.url.database,
            'user_count': user_count,
            'tables': [table for table in db.metadata.tables.keys()]
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'status': 'disconnected',
            'error': str(e)
        }), 500

@auth_bp.route('/register-device', methods=['POST'])
@jwt_required()
def register_trusted_device():
    current_user_id = get_jwt_identity()
    data = request.get_json()
    
    if not data or not data.get('deviceId'):
        return jsonify({'error': 'Device ID is required'}), 400
    
    device_id = data.get('deviceId')
    device_info = data.get('deviceInfo', {})
    
    # Store in the trusted devices dictionary
    if current_user_id not in trusted_devices:
        trusted_devices[current_user_id] = []
        
    # Check if device is already registered
    if device_id not in [d['id'] for d in trusted_devices[current_user_id]]:
        trusted_devices[current_user_id].append({
            'id': device_id,
            'info': device_info,
            'added_at': datetime.utcnow().isoformat()
        })
    
    return jsonify({
        'message': 'Device registered successfully',
        'device_id': device_id
    })

@auth_bp.route('/remove-device', methods=['POST'])
@jwt_required()
def remove_trusted_device():
    current_user_id = get_jwt_identity()
    data = request.get_json()
    
    if not data or not data.get('deviceId'):
        return jsonify({'error': 'Device ID is required'}), 400
    
    device_id = data.get('deviceId')
    
    if current_user_id in trusted_devices:
        # Filter out the device to remove
        trusted_devices[current_user_id] = [
            d for d in trusted_devices[current_user_id] 
            if d['id'] != device_id
        ]
    
    return jsonify({
        'message': 'Device removed successfully'
    })
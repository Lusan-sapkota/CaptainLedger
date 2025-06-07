from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from models.models import db, User
from utils.email import email_service
import random
from datetime import datetime, timedelta
from flask_mail import Message
from flask import current_app
import sqlite3

auth_bp = Blueprint('auth', __name__)

# Store OTPs in memory (in production, use Redis or DB)
otp_store = {}  # {email: {'otp': '123456', 'expires': datetime}}

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
    
    user = User(
        email=data['email'],
        password_hash=generate_password_hash(data['password'])
    )
    
    db.session.add(user)
    db.session.commit()
    
    # Send welcome email
    email_service.send_welcome_email(
        data['email'], 
        name=data.get('fullName', '')
    )
    
    access_token = create_access_token(identity=user.id)
    
    return jsonify({
        'message': 'User registered successfully',
        'user': {
            'id': user.id,
            'email': user.email
        },
        'token': access_token
    }), 201

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Email and password are required'}), 400
    
    user = User.query.filter_by(email=data['email']).first()
    
    if not user or not check_password_hash(user.password_hash, data['password']):
        return jsonify({'error': 'Invalid credentials'}), 401
    
    # Send login notification
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
        'token': access_token
    })

@auth_bp.route('/profile', methods=['GET'])
@jwt_required()
def profile():
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    return jsonify({
        'id': user.id,
        'email': user.email,
        'created_at': user.created_at,
        'last_sync': user.last_sync
    })

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
            'verified': False, 
            'message': 'OTP expired or not found. Please request a new code.'
        }), 200
    
    if datetime.utcnow() > stored_data['expires']:
        # OTP expired
        otp_store.pop(email, None)
        return jsonify({
            'success': False,
            'verified': False, 
            'message': 'OTP expired. Please request a new code.'
        }), 200
    
    if otp != stored_data['otp']:
        return jsonify({
            'success': False,
            'verified': False, 
            'message': 'Invalid verification code.'
        }), 200
    
    # OTP is valid - update user verification status using SQLAlchemy
    try:
        user = User.query.filter_by(email=email).first()
        
        if user:
            user.email_verified = True
            user.email_verified_at = datetime.utcnow()
            db.session.commit()
            
            # Clear OTP from store
            otp_store.pop(email, None)
            
            return jsonify({
                'success': True,
                'verified': True,
                'message': 'Email verified successfully'
            }), 200
        else:
            return jsonify({
                'success': False,
                'verified': False,
                'message': 'User not found. Please sign up first.'
            }), 200
    except Exception as e:
        db.session.rollback()
        print(f"Database error during OTP verification: {e}")
        return jsonify({
            'success': False,
            'verified': False,
            'message': 'An error occurred while verifying your email.'
        }), 500

# Add this route to handle OTP resending

@auth_bp.route('/resend-otp', methods=['POST'])
def resend_otp():
    data = request.get_json()
    email = data.get('email')
    
    if not email:
        return jsonify({'error': 'Email is required'}), 400
    
    # Check if user exists in database using SQLAlchemy
    try:
        user = User.query.filter_by(email=email).first()
        
        if not user:
            return jsonify({
                'success': False,
                'message': 'User not found. Please sign up first.'
            }), 200
    except Exception as e:
        print(f"Database error during OTP resend: {e}")
        return jsonify({
            'success': False,
            'message': 'An error occurred. Please try again later.'
        }), 500
    
    # Generate new OTP
    new_otp = generate_otp()
    otp_store[email] = {
        'otp': new_otp,
        'expires': datetime.utcnow() + timedelta(minutes=15)  # OTP valid for 15 minutes
    }
    
    # In production, send email with OTP here
    # send_otp_email(email, new_otp)
    
    # For testing purposes, log the OTP
    print(f"OTP for {email}: {new_otp}")
    
    return jsonify({
        'success': True,
        'message': 'Verification code sent successfully'
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
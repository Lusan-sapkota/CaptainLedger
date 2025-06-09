from flask import Blueprint, request, jsonify, current_app
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from models.models import db, User
import random
import string
from datetime import datetime, timedelta
from utils.email import email_service
import os
from werkzeug.utils import secure_filename

auth_bp = Blueprint('auth', __name__)

# Add OTP storage (in production, use Redis or database)
otp_storage = {}

def generate_otp():
    """Generate a 6-digit OTP"""
    return ''.join(random.choices(string.digits, k=6))

@auth_bp.route('/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['email', 'password', 'fullName']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        email = data['email'].lower().strip()
        password = data['password']
        full_name = data['fullName']
        country = data.get('country', 'Nepal')
        gender = data.get('gender', '')
        
        # Check if user already exists
        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            return jsonify({'error': 'Email already registered'}), 400
        
        # Generate OTP
        otp = generate_otp()
        otp_expiry = datetime.utcnow() + timedelta(minutes=10)  # 10 minutes expiry
        
        # Store OTP temporarily (use Redis in production)
        otp_storage[email] = {
            'otp': otp,
            'expiry': otp_expiry,
            'user_data': {
                'email': email,
                'password': password,
                'full_name': full_name,
                'country': country,
                'gender': gender
            }
        }
        
        # Send OTP email
        if email_service.send_otp_email(email, otp, full_name):
            return jsonify({
                'message': 'Registration initiated. Please check your email for OTP.',
                'email': email
            }), 201
        else:
            # If email fails, still allow registration for development
            current_app.logger.warning(f"Failed to send OTP email to {email}")
            return jsonify({
                'message': 'Registration initiated. OTP: ' + otp + ' (Dev mode)',
                'email': email,
                'dev_otp': otp  # Only for development
            }), 201
            
    except Exception as e:
        current_app.logger.error(f"Registration error: {str(e)}")
        return jsonify({'error': 'Registration failed'}), 500

@auth_bp.route('/verify-otp', methods=['POST'])
def verify_otp():
    try:
        data = request.get_json()
        email = data.get('email', '').lower().strip()
        otp = data.get('otp', '')
        
        # Check OTP
        if email not in otp_storage:
            return jsonify({'error': 'No OTP found for this email'}), 400
        
        stored_data = otp_storage[email]
        
        # Check if OTP expired
        if datetime.utcnow() > stored_data['expiry']:
            del otp_storage[email]
            return jsonify({'error': 'OTP has expired'}), 400
        
        # Verify OTP
        if stored_data['otp'] != otp:
            return jsonify({'error': 'Invalid OTP'}), 400
        
        # Create user account
        user_data = stored_data['user_data']
        hashed_password = generate_password_hash(user_data['password'])
        
        current_time = datetime.utcnow()
        
        # Create user with all fields
        new_user = User(
            email=user_data['email'],
            password_hash=hashed_password,
            fullName=user_data['full_name'],
            country=user_data['country'],
            gender=user_data.get('gender', ''),
            email_verified=True,
            email_verified_at=current_time,
            is_active=True,
            is_verified=True,
            created_at=current_time,
            last_login=current_time,
            last_login_ip=request.remote_addr,
            last_login_device=request.headers.get('User-Agent', 'Unknown'),
            last_login_location='',  # This would require IP geolocation service
            profile_picture=''  # Default empty profile picture
        )
        
        db.session.add(new_user)
        db.session.commit()
        
        # Clean up OTP
        del otp_storage[email]
        
        # Generate JWT token
        access_token = create_access_token(identity=new_user.id)
        
        # Send welcome email
        email_service.send_welcome_email(new_user.email, new_user.fullName)
        
        # Return complete user object
        return jsonify({
            'message': 'Registration completed successfully',
            'token': access_token,
            'user': {
                'id': new_user.id,
                'email': new_user.email,
                'full_name': new_user.fullName,
                'country': new_user.country,
                'gender': new_user.gender,
                'profile_picture': new_user.profile_picture,
                'last_login': new_user.last_login.isoformat() if new_user.last_login else None,
                'created_at': new_user.created_at.isoformat() if new_user.created_at else None,
                'is_active': new_user.is_active,
                'is_verified': new_user.is_verified
            }
        }), 201
        
    except Exception as e:
        current_app.logger.error(f"OTP verification error: {str(e)}")
        return jsonify({'error': 'OTP verification failed'}), 500

@auth_bp.route('/resend-otp', methods=['POST'])
def resend_otp():
    try:
        data = request.get_json()
        email = data.get('email', '').lower().strip()
        
        if not email or email not in otp_storage:
            return jsonify({'error': 'No registration found for this email'}), 400
        
        # Generate new OTP
        otp = generate_otp()
        otp_expiry = datetime.utcnow() + timedelta(minutes=10)
        
        # Update stored OTP
        otp_storage[email]['otp'] = otp
        otp_storage[email]['expiry'] = otp_expiry
        
        # Get user data
        user_data = otp_storage[email]['user_data']
        
        # Send new OTP email
        if email_service.send_otp_email(email, otp, user_data['full_name']):
            return jsonify({'message': 'New OTP sent successfully'}), 200
        else:
            return jsonify({
                'message': 'OTP resent. OTP: ' + otp + ' (Dev mode)',
                'dev_otp': otp
            }), 200
            
    except Exception as e:
        current_app.logger.error(f"Resend OTP error: {str(e)}")
        return jsonify({'error': 'Failed to resend OTP'}), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        
        if not data or not data.get('email') or not data.get('password'):
            return jsonify({'error': 'Email and password are required'}), 400
        
        user = User.query.filter_by(email=data['email']).first()
        
        if not user or not check_password_hash(user.password_hash, data['password']):
            return jsonify({'error': 'Invalid credentials'}), 401
        
        # Get IP address - handle proxy servers properly
        ip_address = request.headers.get('X-Forwarded-For', request.remote_addr)
        if ip_address and ',' in ip_address:
            # If multiple IP addresses, take the first one (client IP)
            ip_address = ip_address.split(',')[0].strip()
            
        # Look up location from IP address
        try:
            location = email_service.get_location_from_ip(ip_address)
        except:
            location = "Unknown location"
        
        # Update login information
        user.last_login = datetime.utcnow()
        user.last_login_ip = ip_address
        user.last_login_device = request.headers.get('User-Agent', 'Unknown')
        user.last_login_location = location
        
        db.session.commit()
        
        access_token = create_access_token(identity=user.id)
        
        # Send login notification email with IP and location
        try:
            email_service.send_login_notification(
                user.email,
                device_info=f"{user.last_login_device}",
                ip_address=ip_address
            )
        except Exception as e:
            current_app.logger.error(f"Failed to send login notification: {e}")
        
        return jsonify({
            'message': 'Login successful',
            'user': {
                'id': user.id,
                'email': user.email,
                'full_name': user.fullName,
                'country': user.country,
                'last_login_location': location
            },
            'token': access_token
        })
    except Exception as e:
        current_app.logger.error(f"Login error: {e}")
        return jsonify({'error': 'Login failed'}), 500

@auth_bp.route('/profile', methods=['GET'])
@jwt_required()
def profile():
    try:
        current_user_id = get_jwt_identity()
        
        if not current_user_id:
            return jsonify({'error': 'Invalid or missing token'}), 401
            
        user = User.query.get(current_user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Build response with safe attribute access
        user_data = {
            'id': user.id,
            'email': user.email,
            'full_name': getattr(user, 'fullName', ''),
            'country': getattr(user, 'country', 'Nepal'),
            'gender': getattr(user, 'gender', ''),
            'profile_picture': getattr(user, 'profile_picture', ''),
            'last_login': getattr(user, 'last_login', None),
            'last_login_ip': getattr(user, 'last_login_ip', ''),
            'last_login_device': getattr(user, 'last_login_device', ''),
            'last_login_location': getattr(user, 'last_login_location', ''),
            'is_active': getattr(user, 'is_active', True),
            'is_verified': getattr(user, 'is_verified', False),
            'created_at': getattr(user, 'created_at', None),
            'last_sync': getattr(user, 'last_sync', None)
        }
        
        # Format datetime objects
        for key, value in user_data.items():
            if isinstance(value, datetime):
                user_data[key] = value.isoformat()
        
        return jsonify(user_data)
        
    except Exception as e:
        current_app.logger.error(f"Profile endpoint error: {str(e)}")
        return jsonify({'error': 'Authentication failed'}), 401

@auth_bp.route('/status', methods=['GET'])
def status():
    """Health check endpoint that doesn't require authentication"""
    return jsonify({'status': 'ok', 'message': 'CaptainLedger API is running'}), 200

@auth_bp.route('/update-profile', methods=['PUT'])
@jwt_required()
def update_profile():
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        
        # Update fields if provided
        if 'full_name' in data:
            user.fullName = data['full_name']
        
        if 'bio' in data:
            user.bio = data['bio']
            
        if 'phone_number' in data:
            user.phone_number = data['phone_number']
            
        if 'country' in data:
            user.country = data['country']
            
        if 'gender' in data:
            user.gender = data['gender']
        
        # Save changes
        db.session.commit()
        
        return jsonify({
            'message': 'Profile updated successfully',
            'user': {
                'id': user.id,
                'email': user.email,
                'full_name': user.fullName,
                'bio': getattr(user, 'bio', ''),
                'phone_number': getattr(user, 'phone_number', ''),
                'country': user.country,
                'gender': getattr(user, 'gender', ''),
                'profile_picture': getattr(user, 'profile_picture', ''),
                'updated_at': datetime.utcnow().isoformat()
            }
        })
        
    except Exception as e:
        current_app.logger.error(f"Profile update error: {str(e)}")
        db.session.rollback()
        return jsonify({'error': 'Failed to update profile'}), 500

@auth_bp.route('/upload-profile-picture', methods=['POST'])
@jwt_required()
def upload_profile_picture():
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        if 'profile_picture' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
            
        file = request.files['profile_picture']
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
            
        if file:
            # Create uploads directory if it doesn't exist
            uploads_dir = os.path.join(current_app.root_path, 'static/uploads/profiles')
            os.makedirs(uploads_dir, exist_ok=True)
            
            # Secure the filename and generate unique name
            filename = secure_filename(file.filename)
            file_ext = os.path.splitext(filename)[1]
            unique_filename = f"user_{user.id}_{datetime.now().strftime('%Y%m%d%H%M%S')}{file_ext}"
            file_path = os.path.join(uploads_dir, unique_filename)
            
            # Save the file
            file.save(file_path)
            
            # Update user profile picture path in database
            relative_path = f"/static/uploads/profiles/{unique_filename}"
            user.profile_picture = relative_path
            db.session.commit()
            
            return jsonify({
                'message': 'Profile picture uploaded successfully',
                'profile_picture_url': relative_path
            })
    
    except Exception as e:
        current_app.logger.error(f"Profile picture upload error: {str(e)}")
        db.session.rollback()
        return jsonify({'error': 'Failed to upload profile picture'}), 500

@auth_bp.route('/login-history', methods=['GET'])
@jwt_required()
def login_history():
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
            
        # For now, return mock data since we don't store multiple login records
        # In a real app, you'd query a login_history table
        return jsonify([
            {
                'date': user.last_login.isoformat() if user.last_login else datetime.utcnow().isoformat(),
                'ip': user.last_login_ip or 'Unknown',
                'device': user.last_login_device or 'Unknown',
                'location': user.last_login_location or 'Unknown',
                'type': 'login'
            }
        ])
    except Exception as e:
        current_app.logger.error(f"Login history error: {str(e)}")
        return jsonify({'error': 'Failed to retrieve login history'}), 500
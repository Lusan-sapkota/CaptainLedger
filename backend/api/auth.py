from flask import Blueprint, request, jsonify, current_app, make_response
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from models.models import db, User, Currency, CurrencyPreference
import random
import string
from datetime import datetime, timedelta
from utils.email import email_service
import os
from werkzeug.utils import secure_filename
from utils.currency_mapping import get_country_currency_mapping

auth_bp = Blueprint('auth', __name__)

# Add OTP storage (in production, use Redis or database)
otp_storage = {}

def generate_otp():
    """Generate a 6-digit OTP"""
    return ''.join(random.choices(string.digits, k=6))

# OPTIONS requests are now handled automatically by Flask-CORS

@auth_bp.route('/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['email', 'password', 'fullName']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        # Better email validation with logging
        raw_email = data.get('email', '')
        if not raw_email:
            return jsonify({'error': 'Email is required'}), 400
            
        email = raw_email.lower().strip()
        print(f"Attempting to register with email: '{email}'")
        
        # More comprehensive email validation
        import re
        email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_regex, email):
            print(f"Email validation failed for: '{email}'")
            return jsonify({'error': 'Invalid email format. Please use a valid email address.'}), 400
            
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

        # Generate a username from the email or full name
        email_username = user_data['email'].split('@')[0]  # Use part before @ in email
        # Ensure username is unique
        base_username = email_username
        count = 1
        while User.query.filter_by(username=base_username).first():
            base_username = f"{email_username}{count}"
            count += 1

        # First create the user with only basic parameters
        new_user = User(
            email=user_data['email'],
            username=base_username,  # Add username here
            password_hash=hashed_password,
            fullName=user_data['full_name'],
            country=user_data['country'],
            gender=user_data.get('gender', '')
        )

        # Get country-based currency mapping and set preferred currency
        country_currency_map = get_country_currency_mapping()
        default_currency = country_currency_map.get(user_data['country'], 'USD')
        new_user.preferred_currency = default_currency

        # Then set the additional fields as attributes
        new_user.is_active = True
        new_user.is_verified = True
        new_user.created_at = current_time
        new_user.last_login = current_time
        new_user.last_login_ip = request.remote_addr
        new_user.last_login_device = request.headers.get('User-Agent', 'Unknown')
        new_user.last_login_location = ''
        new_user.profile_picture = ''

        db.session.add(new_user)
        db.session.flush()  # Flush to get the user ID

        # Create default currency preference for the user
        try:
            # Verify the currency exists in our database
            currency_exists = Currency.query.filter_by(code=default_currency, is_active=True).first()
            if currency_exists:
                default_preference = CurrencyPreference(
                    user_id=new_user.id,
                    currency_code=default_currency,
                    is_primary=True,
                    display_order=0
                )
                db.session.add(default_preference)
                print(f"✅ Set default currency {default_currency} for user from {user_data['country']}")
            else:
                print(f"⚠️ Currency {default_currency} not found, defaulting to USD")
                # Fallback to USD if the mapped currency doesn't exist
                new_user.preferred_currency = 'USD'
                default_preference = CurrencyPreference(
                    user_id=new_user.id,
                    currency_code='USD',
                    is_primary=True,
                    display_order=0
                )
                db.session.add(default_preference)
        except Exception as e:
            print(f"Error creating currency preference: {e}")
            # Continue without failing registration

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
                'preferred_currency': new_user.preferred_currency,
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
        
        # Get device information
        device_id = data.get('deviceId')
        is_trusted_device = data.get('isTrustedDevice', False)
        
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
        
        # Create JWT token with extended expiration (30 days)
        access_token = create_access_token(
            identity=user.id,
            expires_delta=timedelta(days=30)  # 30-day session
        )
        
        # Only send login notification email if device is not trusted
        if not is_trusted_device:
            try:
                email_service.send_login_notification(
                    user.email,
                    device_info=f"{user.last_login_device}",
                    ip_address=ip_address,
                    location=location
                )
                print(f"Login notification sent to {user.email} (untrusted device)")
            except Exception as e:
                current_app.logger.error(f"Failed to send login notification: {e}")
        else:
            print(f"Skipping login notification for {user.email} (trusted device)")
        
        return jsonify({
            'message': 'Login successful',
            'user': {
                'id': user.id,
                'email': user.email,
                'full_name': user.fullName,
                'country': user.country,
                'last_login_location': location
            },
            'token': access_token,
            'session_expires': (datetime.utcnow() + timedelta(days=30)).isoformat(),
            'is_trusted_device': is_trusted_device
        })
    except Exception as e:
        current_app.logger.error(f"Login error: {e}")
        return jsonify({'error': 'Login failed'}), 500

@auth_bp.route('/profile', methods=['GET'])
@jwt_required()
def get_profile():
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user:
            return jsonify({"error": "User not found"}), 404
            
        return jsonify({
            "id": user.id,
            "email": user.email,
            "full_name": user.fullName,  # Changed from name to fullName
            "created_at": user.created_at.isoformat() if user.created_at else None,
            # Add any other fields needed by the frontend
            "country": getattr(user, 'country', ''),
            "gender": getattr(user, 'gender', ''),
            "profile_picture": getattr(user, 'profile_picture', '')
        })
    except Exception as e:
        current_app.logger.error(f"Profile fetch error: {str(e)}")
        return jsonify({"error": str(e)}), 500  # Changed from 401 to 500

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
            
        history = []
        
        if user.last_login:
            # Add the most recent login
            history.append({
                'date': user.last_login.isoformat(),
                'device': user.last_login_device,
                'ip': user.last_login_ip,
                'location': user.last_login_location,
                'type': 'login'
            })
            
        return jsonify(history)
        
    except Exception as e:
        current_app.logger.error(f"Login history error: {str(e)}")
        return jsonify({'error': 'Failed to retrieve login history'}), 500
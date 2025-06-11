import os
import smtplib
import threading
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from flask import current_app
import requests  # Add this import for geolocation API

class EmailService:
    def __init__(self):
        self.smtp_server = os.environ.get('SMTP_SERVER')
        self.smtp_port = int(os.environ.get('SMTP_PORT', 587))
        self.sender_email = os.environ.get('SENDER_EMAIL')
        self.sender_password = os.environ.get('SENDER_PASSWORD')
        self.geolocation_api_key = os.environ.get('GEOLOCATION_API_KEY', '')
    
    def _send_email_async(self, to_email, subject, html_content):
        """Send email in a separate thread to avoid blocking the main thread."""
        thread = threading.Thread(
            target=self._send_email_worker,
            args=(to_email, subject, html_content)
        )
        thread.daemon = True
        thread.start()
        return True
    
    def _send_email_worker(self, to_email, subject, html_content):
        """Worker function that actually sends the email."""
        try:
            message = MIMEMultipart("alternative")
            message["Subject"] = subject
            message["From"] = f"CaptainLedger <{self.sender_email}>"
            message["To"] = to_email
            # Add Content-Type header with charset
            message["Content-Type"] = "text/html; charset=utf-8"
            
            # Convert HTML content to MIMEText
            html_part = MIMEText(html_content, "html", "utf-8")
            message.attach(html_part)
            
            # Send email
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.ehlo()
                
                if server.has_extn('STARTTLS'):
                    server.starttls()
                    server.ehlo()
                    
                server.login(self.sender_email, self.sender_password)
                
                # Convert message to bytes explicitly with UTF-8 encoding
                message_bytes = message.as_string().encode('utf-8')
                server.sendmail(self.sender_email, to_email, message_bytes)
                
            current_app.logger.info(f"Email sent to {to_email}")
            return True
        except Exception as e:
            # Use print instead of current_app.logger outside of app context
            print(f"Failed to send email: {str(e)}")
            return False
    
    def get_location_from_ip(self, ip_address):
        """Get location information from IP address using ipinfo.io service"""
        if not ip_address or ip_address == '127.0.0.1' or ip_address.startswith('192.168.'):
            return "Local network"
            
        try:
            # Free tier of ipinfo.io doesn't require API key for limited usage
            if self.geolocation_api_key:
                url = f"https://ipinfo.io/{ip_address}?token={self.geolocation_api_key}"
            else:
                url = f"https://ipinfo.io/{ip_address}/json"
                
            response = requests.get(url, timeout=3)
            if response.status_code == 200:
                data = response.json()
                city = data.get('city', '')
                region = data.get('region', '')
                country = data.get('country', '')
                
                location_parts = [part for part in [city, region, country] if part]
                if location_parts:
                    return ", ".join(location_parts)
            
            return "Unknown location"
        except Exception as e:
            current_app.logger.error(f"Geolocation error: {str(e)}")
            return "Location lookup failed"
    
    def send_welcome_email(self, email, name=""):
        """Send a welcome email to new users."""
        subject = "Welcome to CaptainLedger! 🚀"
        
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #27AE60; padding: 20px; text-align: center; color: white;">
                <h1>Welcome to CaptainLedger!</h1>
            </div>
            <div style="padding: 20px; background-color: #f9f9f9;">
                <p>Hello{f" {name}" if name else ""},</p>
                <p>Thank you for joining CaptainLedger - your personal finance tracker that puts privacy first.</p>
                <p>With CaptainLedger, you can:</p>
                <ul>
                    <li>Track your expenses and income</li>
                    <li>Work offline - your data stays on your device</li>
                    <li>Sync when you want, with your own server</li>
                    <li>Keep your financial data private</li>
                </ul>
                <p>If you have any questions or feedback, just reply to this email!</p>
                <p>Best regards,<br>The CaptainLedger Team</p>
            </div>
            <div style="background-color: #2C3E50; color: white; padding: 15px; text-align: center; font-size: 12px;">
                <p>&copy; {datetime.now().year} CaptainLedger. All rights reserved.</p>
            </div>
        </div>
        """
        
        return self._send_email_async(email, subject, html_content)
    
    def send_login_notification(self, email, device_info="", ip_address=""):
        """Send a login notification email with location info."""
        subject = "New Login to CaptainLedger"
        
        # Get location from IP if provided
        location = "Unknown"
        if ip_address:
            location = self.get_location_from_ip(ip_address)
        
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #27AE60; padding: 20px; text-align: center; color: white;">
                <h1>New Login Detected</h1>
            </div>
            <div style="padding: 20px; background-color: #f9f9f9;">
                <p>Hello,</p>
                <p>We detected a new login to your CaptainLedger account.</p>
                <p><strong>Time:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} UTC</p>
                <p><strong>Device:</strong> {device_info}</p>
                <p><strong>Location:</strong> {location}</p>
                <p>If this was you, you can ignore this email. If you didn't login recently, please change your password immediately.</p>
                <p>Best regards,<br>The CaptainLedger Team</p>
            </div>
            <div style="background-color: #2C3E50; color: white; padding: 15px; text-align: center; font-size: 12px;">
                <p>&copy; {datetime.now().year} CaptainLedger. All rights reserved.</p>
            </div>
        </div>
        """
        
        return self._send_email_async(email, subject, html_content)
    
    def send_otp_email(self, email, otp, name=""):
        """Send an OTP verification email."""
        subject = "Verify Your CaptainLedger Account"
        
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #27AE60; padding: 20px; text-align: center; color: white;">
                <h1>Verify Your Account</h1>
            </div>
            <div style="padding: 30px; background-color: #f9f9f9; text-align: center;">
                <p>Hello{f" {name}" if name else ""},</p>
                <p>Thank you for signing up for CaptainLedger! Please use the verification code below to complete your registration:</p>
                
                <div style="background-color: #fff; border: 2px dashed #27AE60; border-radius: 8px; padding: 20px; margin: 20px 0; font-size: 32px; font-weight: bold; color: #27AE60; letter-spacing: 8px;">
                    {otp}
                </div>
                
                <p style="color: #666; font-size: 14px;">This code will expire in 10 minutes.</p>
                <p style="color: #666; font-size: 14px;">If you didn't request this, please ignore this email.</p>
                
                <p>Best regards,<br>The CaptainLedger Team</p>
            </div>
            <div style="background-color: #2C3E50; color: white; padding: 15px; text-align: center; font-size: 12px;">
                <p>&copy; {datetime.now().year} CaptainLedger. All rights reserved.</p>
            </div>
        </div>
        """
        
        return self._send_email_async(email, subject, html_content)

# Create a singleton instance
email_service = EmailService()
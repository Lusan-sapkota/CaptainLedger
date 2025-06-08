import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from flask import current_app

class EmailService:
    def __init__(self):
        self.smtp_server = os.environ.get('SMTP_SERVER')
        self.smtp_port = int(os.environ.get('SMTP_PORT', 587))
        self.sender_email = os.environ.get('SENDER_EMAIL')
        self.sender_password = os.environ.get('SENDER_PASSWORD')
        
    def _send_email(self, recipient, subject, html_content, text_content=""):
        """Send an email with both HTML and plain text versions."""
        if not self.sender_email or not self.sender_password:
            current_app.logger.warning("Email credentials not configured. Skipping email send.")
            return False
        
        try:
            message = MIMEMultipart("alternative")
            message["Subject"] = subject
            message["From"] = f"CaptainLedger <{self.sender_email}>"
            message["To"] = recipient
            
            # Add plain text and HTML parts
            if text_content:
                message.attach(MIMEText(text_content, "plain"))
            message.attach(MIMEText(html_content, "html"))
            
            # Connect to server and send email
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                server.login(self.sender_email, self.sender_password)
                server.sendmail(self.sender_email, recipient, message.as_string())
            
            current_app.logger.info(f"Email sent to {recipient}")
            return True
            
        except Exception as e:
            current_app.logger.error(f"Failed to send email: {str(e)}")
            return False
    
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
                <p>© {datetime.now().year} CaptainLedger. All rights reserved.</p>
            </div>
        </div>
        """
        
        return self._send_email(email, subject, html_content)
    
    def send_login_notification(self, email, device_info=""):
        """Send a login notification email."""
        subject = "New Login to CaptainLedger"
        
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
                <p>If this was you, you can ignore this email. If you didn't login recently, please change your password immediately.</p>
                <p>Best regards,<br>The CaptainLedger Team</p>
            </div>
            <div style="background-color: #2C3E50; color: white; padding: 15px; text-align: center; font-size: 12px;">
                <p>© {datetime.now().year} CaptainLedger. All rights reserved.</p>
            </div>
        </div>
        """
        
        return self._send_email(email, subject, html_content)

# Create a singleton instance
email_service = EmailService()
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
import os
import time
import logging
from datetime import datetime, timedelta
from flask import current_app
from models.models import User, Notification, db

class EmailService:
    def __init__(self):
        self.email = os.environ.get('EMAIL_USER')
        self.password = os.environ.get('EMAIL_PASSWORD')
        self.smtp_server = os.environ.get('EMAIL_HOST', 'smtp.zoho.com')
        self.smtp_port = int(os.environ.get('EMAIL_PORT', 587))
        
        # Define strict rate limits (in hours between emails)
        self.rate_limits = {
            'budget_alert': 24,      # Once per day
            'weekly_report': 168,    # Once per week (7 days)
            'monthly_report': 720,   # Once per month (30 days)
            'loan_reminder': 48,     # Once every 2 days
            'general': 12            # General emails: once per 12 hours
        }

    def can_send_email(self, user_id, email_type):
        """Check if we can send an email based on strict rate limits"""
        try:
            # Get hours limit for this email type
            hours_limit = self.rate_limits.get(email_type, 24)  # Default: 24 hours
            
            # Calculate the cutoff time
            cutoff_time = datetime.utcnow() - timedelta(hours=hours_limit)
            
            # Check for any emails of this type sent after the cutoff
            recent_email = Notification.query.filter(
                Notification.user_id == user_id,
                Notification.type == email_type,
                Notification.created_at > cutoff_time
            ).first()
            
            # If we found a recent email, we can't send another one yet
            if recent_email:
                time_since_last = datetime.utcnow() - recent_email.created_at
                hours_since_last = time_since_last.total_seconds() / 3600
                hours_remaining = hours_limit - hours_since_last
                
                current_app.logger.info(
                    f"Rate limit hit for {email_type}: User {user_id} last received one {hours_since_last:.1f} hours ago. "
                    f"Must wait {hours_remaining:.1f} more hours."
                )
                return False
                
            return True
            
        except Exception as e:
            current_app.logger.error(f"Error checking email rate limit: {e}")
            # Default to False to prevent emails on errors
            return False

    def record_email_sent(self, user_id, email_type, title, message):
        """Record that an email was sent in the notifications table for rate limiting"""
        try:
            notification = Notification(
                user_id=user_id,
                type=email_type,
                title=title,
                message=message,
                is_read=False
            )
            db.session.add(notification)
            db.session.commit()
            return True
        except Exception as e:
            current_app.logger.error(f"Error recording email notification: {e}")
            return False

    def send_weekly_report(self, email, name, transactions, currency='USD'):
        """Send weekly financial report with strict rate limiting"""
        user = User.query.filter_by(email=email).first()
        if not user:
            current_app.logger.error(f"User not found for email: {email}")
            return False
            
        # Apply strict rate limiting (once per week)
        if not self.can_send_email(user.id, 'weekly_report'):
            current_app.logger.info(f"Weekly report rate limit: blocked for {email}")
            return False
            
        # Calculate report data with proper currency
        income_transactions = [t for t in transactions if t.get('amount', 0) > 0]
        expense_transactions = [t for t in transactions if t.get('amount', 0) < 0]
        
        total_income = sum(t.get('amount', 0) for t in income_transactions)
        total_expenses = sum(abs(t.get('amount', 0)) for t in expense_transactions)
        
        # Create email content with currency
        subject = "Your Weekly Financial Report"
        html = f"""
        <html>
        <body>
            <h2>Hello {name},</h2>
            <p>Here is your weekly report:</p>
            <p>Income: {currency} {total_income:.2f}<br>
            Expenses: {currency} {total_expenses:.2f}<br>
            Transactions: {len(transactions)}</p>
            
            <h3>Recent Transactions:</h3>
            <ul>
            {"".join([f"<li>{t.get('date')[:10]} - {t.get('category', 'Uncategorized')}: {t.get('currency', currency)} {abs(t.get('amount', 0)):.2f} ({t.get('note', 'No description')})</li>" for t in transactions[:5]])}
            </ul>
            
            <p>Best regards,<br>
            The CaptainLedger Team</p>
        </body>
        </html>
        """
        
        # Send the email
        success = self.send_generic_email(email, subject, html)
        
        # Record the email sent for rate limiting
        if success:
            self.record_email_sent(user.id, 'weekly_report', 'Weekly Report Sent', f'Weekly financial report for {len(transactions)} transactions')
            current_app.logger.info(f"Weekly report sent successfully to {email}")
        
        return success

    def send_monthly_report(self, email, name, transactions, currency='USD'):
        """Send monthly financial report with strict rate limiting"""
        user = User.query.filter_by(email=email).first()
        if not user:
            current_app.logger.error(f"User not found for email: {email}")
            return False
            
        # Apply strict rate limiting (once per month)
        if not self.can_send_email(user.id, 'monthly_report'):
            current_app.logger.info(f"Monthly report rate limit: blocked for {email}")
            return False
            
        # Calculate monthly data with proper currency
        income_transactions = [t for t in transactions if t.get('amount', 0) > 0]
        expense_transactions = [t for t in transactions if t.get('amount', 0) < 0]
        
        total_income = sum(t.get('amount', 0) for t in income_transactions)
        total_expenses = sum(abs(t.get('amount', 0)) for t in expense_transactions)
        net_balance = total_income - total_expenses
        
        # Group by category for the report
        categories = {}
        for t in transactions:
            category = t.get('category', 'Uncategorized')
            amount = abs(t.get('amount', 0))
            if category not in categories:
                categories[category] = 0
            categories[category] += amount
            
        # Sort categories by amount
        sorted_categories = sorted(categories.items(), key=lambda x: x[1], reverse=True)
        
        # Create email content with currency
        subject = "Your Monthly Financial Summary"
        html = f"""
        <html>
        <body>
            <h2>Hello {name},</h2>
            <p>Here is your monthly financial summary:</p>
            <p>
            Total Income: {currency} {total_income:.2f}<br>
            Total Expenses: {currency} {total_expenses:.2f}<br>
            Net Balance: {currency} {net_balance:.2f}<br>
            Transactions: {len(transactions)}
            </p>
            
            <h3>Top Spending Categories:</h3>
            <ul>
            {"".join([f"<li>{cat}: {currency} {amount:.2f}</li>" for cat, amount in sorted_categories[:5]])}
            </ul>
            
            <p>Best regards,<br>
            The CaptainLedger Team</p>
        </body>
        </html>
        """
        
        # Send the email
        success = self.send_generic_email(email, subject, html)
        
        # Record the email sent for rate limiting
        if success:
            self.record_email_sent(user.id, 'monthly_report', 'Monthly Report Sent', f'Monthly financial report with {len(transactions)} transactions')
            current_app.logger.info(f"Monthly report sent successfully to {email}")
            
        return success

    def send_budget_alert(self, email, name, budget_percent, currency='USD'):
        """Send budget alert with strict rate limiting (once per day)"""
        user = User.query.filter_by(email=email).first()
        if not user:
            current_app.logger.error(f"User not found for email: {email}")
            return False
            
        # Apply strict rate limiting (once per day)
        if not self.can_send_email(user.id, 'budget_alert'):
            current_app.logger.info(f"Budget alert rate limit: blocked for {email}")
            return False
            
        # Create email content with budget warning
        subject = "Budget Alert"
        severity = "critical" if budget_percent > 90 else "warning" if budget_percent > 75 else "notice"
        color = "#e74c3c" if budget_percent > 90 else "#f39c12" if budget_percent > 75 else "#3498db"
        
        html = f"""
        <html>
        <body>
            <h2>Hello {name},</h2>
            <p>This is a budget {severity} alert:</p>
            <p style="font-size: 18px; font-weight: bold; color: {color}">
                You've already spent {budget_percent}% of your monthly budget.
            </p>
            <p>
                Consider reviewing your spending habits or adjusting your budget.
            </p>
            <p>Best regards,<br>
            The CaptainLedger Team</p>
        </body>
        </html>
        """
        
        # Send the email
        success = self.send_generic_email(email, subject, html)
        
        # Record the email sent for rate limiting
        if success:
            self.record_email_sent(user.id, 'budget_alert', f'Budget {severity.capitalize()} Alert', f'Budget {severity} alert: {budget_percent}% spent')
            current_app.logger.info(f"Budget alert sent successfully to {email}")
            
        return success

    def send_generic_email(self, to_email, subject, html_body):
        """Send a generic HTML email with retries and rate limiting"""
        max_retry_attempts = 2
        retry_count = 0
        
        while retry_count <= max_retry_attempts:
            try:
                # Check if email credentials are available
                if not self.email or not self.password:
                    current_app.logger.error("Email credentials not configured")
                    return False
                
                msg = MIMEMultipart()
                msg['From'] = self.email
                msg['To'] = to_email
                msg['Subject'] = subject
                
                # Add html body
                msg.attach(MIMEText(html_body, 'html'))
                
                # Send email
                server = smtplib.SMTP(self.smtp_server, self.smtp_port)
                server.starttls()
                server.login(self.email, self.password)
                server.send_message(msg)
                server.quit()
                
                current_app.logger.info(f"Email sent successfully to {to_email}")
                return True
                
            except smtplib.SMTPResponseException as e:
                retry_count += 1
                
                # Handle rate limiting specifically (550 code)
                if e.smtp_code == 550:
                    current_app.logger.warning(f"Email rate limit detected (550): {e.smtp_error}. Attempt {retry_count}/{max_retry_attempts}")
                    if retry_count <= max_retry_attempts:
                        # Exponential backoff: wait longer between each retry
                        time.sleep(5 * retry_count * retry_count)
                        continue
                    else:
                        current_app.logger.error(f"Rate limit error sending email after {max_retry_attempts} attempts: {e}")
                        return False
                else:
                    current_app.logger.error(f"SMTP error sending email: {e}")
                    return False
                    
            except Exception as e:
                current_app.logger.error(f"Error sending email: {e}")
                return False

# Create instance for global use
email_service = EmailService()
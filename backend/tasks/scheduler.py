from flask import Flask, current_app
from flask_apscheduler import APScheduler
from datetime import datetime, timedelta
from models.models import User, Transaction, Notification, CurrencyPreference, db
from utils.email_service import email_service

scheduler = APScheduler()

class ReportScheduler:
    def __init__(self):
        self.app = None
    
    def init_app(self, app: Flask):
        self.app = app
        
        # Configure scheduler for better time management
        scheduler.init_app(app)
        scheduler.start()
        
        # Schedule jobs with careful timing (not all at once)
        # Weekly reports on Monday mornings at 8 AM
        scheduler.add_job(id='weekly_reports', func=self.send_weekly_reports, trigger='cron', day_of_week='mon', hour=8, minute=0)
        
        # Monthly reports on the 1st of each month at 9 AM 
        scheduler.add_job(id='monthly_reports', func=self.send_monthly_reports, trigger='cron', day=1, hour=9, minute=0)
        
        # Add job to clean up old notifications (keep database clean)
        scheduler.add_job(id='clean_notifications', func=self.clean_old_notifications, trigger='cron', day_of_week='sun', hour=3, minute=0)
    
    def send_weekly_reports(self):
        """Generate and send weekly reports to all users with strict rate limiting"""
        with self.app.app_context():
            current_app.logger.info("Starting weekly reports job")
            
            # Process users in batches to avoid server overload
            try:
                # Get active users
                users = User.query.filter_by(is_active=True).limit(100).all()
                
                for user in users:
                    try:
                        # Let the email service handle rate limiting
                        # If a user already received a report in the last 7 days, it won't send another one
                        
                        # Get user's currency preference
                        user_currency = 'USD'  # Default
                        currency_pref = CurrencyPreference.query.filter_by(user_id=user.id).first()
                        if currency_pref:
                            user_currency = currency_pref.currency_code
                        
                        # Get transactions for the past week
                        end_date = datetime.now()
                        start_date = end_date - timedelta(days=7)
                        
                        transactions = Transaction.query.filter(
                            Transaction.user_id == user.id,
                            Transaction.date >= start_date.date(),
                            Transaction.date <= end_date.date()
                        ).all()
                        
                        # Convert to dict format with proper currency
                        transaction_dicts = []
                        for t in transactions:
                            transaction_dicts.append({
                                'id': t.id,
                                'amount': t.amount,
                                'date': t.date.isoformat(),
                                'category': t.category,
                                'note': t.note,
                                'currency': t.currency or user_currency  # Ensure currency is set
                            })
                        
                        # Only send if there are transactions
                        if transaction_dicts:
                            # The email service will handle rate limiting internally
                            email_service.send_weekly_report(
                                user.email, 
                                user.fullName or user.email.split('@')[0], 
                                transaction_dicts, 
                                user_currency
                            )
                        else:
                            current_app.logger.info(f"No transactions found for {user.email} - skipping weekly report")
                    
                    except Exception as e:
                        current_app.logger.error(f"Error processing weekly report for {user.email}: {e}")
                        continue
                
            except Exception as e:
                current_app.logger.error(f"Error in weekly report job: {e}")
    
    def send_monthly_reports(self):
        """Generate and send monthly reports to all users with strict rate limiting"""
        with self.app.app_context():
            current_app.logger.info("Starting monthly reports job")
            
            try:
                # Get active users
                users = User.query.filter_by(is_active=True).limit(100).all()
                
                for user in users:
                    try:
                        # Get user's currency preference
                        user_currency = 'USD'  # Default
                        currency_pref = CurrencyPreference.query.filter_by(user_id=user.id).first()
                        if currency_pref:
                            user_currency = currency_pref.currency_code
                        
                        # Get transactions for the past month
                        end_date = datetime.now()
                        start_date = end_date - timedelta(days=30)
                        
                        transactions = Transaction.query.filter(
                            Transaction.user_id == user.id,
                            Transaction.date >= start_date.date(),
                            Transaction.date <= end_date.date()
                        ).all()
                        
                        # Convert to dict format with proper currency
                        transaction_dicts = []
                        for t in transactions:
                            transaction_dicts.append({
                                'id': t.id,
                                'amount': t.amount,
                                'date': t.date.isoformat(),
                                'category': t.category,
                                'note': t.note,
                                'currency': t.currency or user_currency
                            })
                        
                        # Only send if there are transactions
                        if transaction_dicts:
                            # The email service will handle rate limiting internally
                            email_service.send_monthly_report(
                                user.email, 
                                user.fullName or user.email.split('@')[0], 
                                transaction_dicts, 
                                user_currency
                            )
                        else:
                            current_app.logger.info(f"No transactions found for {user.email} - skipping monthly report")
                    
                    except Exception as e:
                        current_app.logger.error(f"Error processing monthly report for {user.email}: {e}")
                        continue
                        
            except Exception as e:
                current_app.logger.error(f"Error in monthly report job: {e}")
    
    def clean_old_notifications(self):
        """Clean up old notifications to prevent database bloat"""
        with self.app.app_context():
            try:
                # Keep last 6 months of notifications
                cutoff_date = datetime.utcnow() - timedelta(days=180)
                
                # Delete old notifications
                deleted = Notification.query.filter(
                    Notification.created_at < cutoff_date
                ).delete()
                
                db.session.commit()
                current_app.logger.info(f"Cleaned up {deleted} old notifications")
                
            except Exception as e:
                current_app.logger.error(f"Error cleaning up notifications: {e}")

# Create instance for global use
report_scheduler = ReportScheduler()
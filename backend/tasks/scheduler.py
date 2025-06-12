import os
from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from flask import current_app
from models.models import db, User, Transaction
from utils.email import email_service

class ReportScheduler:
    def __init__(self, app=None):
        self.app = app
        self.scheduler = BackgroundScheduler()
        if app:
            self.init_app(app)
    
    def init_app(self, app):
        self.app = app
        
        # Register jobs with application context
        with self.app.app_context():
            # Weekly reports job - Run every Sunday at 7:00 AM
            self.scheduler.add_job(
                self.send_weekly_reports,
                trigger=CronTrigger(day_of_week='sun', hour=7),
                id='weekly_reports',
                replace_existing=True
            )
            
            # Monthly reports job - Run on the 1st of every month at 8:00 AM
            self.scheduler.add_job(
                self.send_monthly_reports,
                trigger=CronTrigger(day=1, hour=8),
                id='monthly_reports',
                replace_existing=True
            )
        
        # Start the scheduler
        self.scheduler.start()
        app.logger.info("Report scheduler started successfully")
        
        # Ensure the scheduler shuts down with the app
        @app.teardown_appcontext
        def shutdown_scheduler(exception=None):
            if self.scheduler.running:
                self.scheduler.shutdown()
    
    def send_weekly_reports(self):
        """Generate and send weekly reports to all users"""
        with self.app.app_context():
            current_app.logger.info("Starting weekly reports job")
            
            # Get all active users
            users = User.query.filter_by(is_active=True).all()
            
            for user in users:
                try:
                    # Get transactions for the past week
                    end_date = datetime.now()
                    start_date = end_date - timedelta(days=7)
                    
                    transactions = Transaction.query.filter(
                        Transaction.user_id == user.id,
                        Transaction.date >= start_date.date(),
                        Transaction.date <= end_date.date()
                    ).all()
                    
                    # Convert to dict format expected by email_service
                    transaction_dicts = [
                        {
                            'id': t.id,
                            'amount': t.amount,
                            'date': t.date.isoformat(),
                            'category': t.category,
                            'note': t.note,
                            'currency': t.currency
                        }
                        for t in transactions
                    ]
                    
                    if transaction_dicts:
                        # Send weekly report
                        current_app.logger.info(f"Sending weekly report to {user.email}")
                        email_service.send_weekly_report(user.email, user.fullName, transaction_dicts)
                
                except Exception as e:
                    current_app.logger.error(f"Error sending weekly report to {user.email}: {e}")
    
    def send_monthly_reports(self):
        """Generate and send monthly reports to all users"""
        with self.app.app_context():
            current_app.logger.info("Starting monthly reports job")
            
            # Get previous month
            today = datetime.today()
            first_day_of_current_month = today.replace(day=1)
            last_day_of_previous_month = first_day_of_current_month - timedelta(days=1)
            first_day_of_previous_month = last_day_of_previous_month.replace(day=1)
            
            month_name = first_day_of_previous_month.strftime('%B %Y')
            
            # Get all active users
            users = User.query.filter_by(is_active=True).all()
            
            for user in users:
                try:
                    # Get transactions for the previous month
                    transactions = Transaction.query.filter(
                        Transaction.user_id == user.id,
                        Transaction.date >= first_day_of_previous_month.date(),
                        Transaction.date <= last_day_of_previous_month.date()
                    ).all()
                    
                    # Convert to dict format expected by email_service
                    transaction_dicts = [
                        {
                            'id': t.id,
                            'amount': t.amount,
                            'date': t.date.isoformat(),
                            'category': t.category,
                            'note': t.note,
                            'currency': t.currency
                        }
                        for t in transactions
                    ]
                    
                    if transaction_dicts:
                        # Send monthly report
                        current_app.logger.info(f"Sending monthly report for {month_name} to {user.email}")
                        email_service.send_monthly_report(user.email, user.fullName, transaction_dicts, month_name)
                
                except Exception as e:
                    current_app.logger.error(f"Error sending monthly report to {user.email}: {e}")

# Create single instance for import
report_scheduler = ReportScheduler()
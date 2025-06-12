from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import uuid

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    fullName = db.Column(db.String(100), nullable=False)
    country = db.Column(db.String(50), default='Nepal')
    gender = db.Column(db.String(20))
    phone_number = db.Column(db.String(20))
    bio = db.Column(db.Text)
    profile_picture = db.Column(db.String(255))
    preferred_currency = db.Column(db.String(3), default='USD')
    date_format = db.Column(db.String(20), default='MM/DD/YYYY')
    timezone = db.Column(db.String(50), default='UTC')
    language = db.Column(db.String(10), default='en')
    notification_enabled = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_sync = db.Column(db.DateTime)
    is_verified = db.Column(db.Boolean, default=False)
    is_active = db.Column(db.Boolean, default=False)
    is_premium = db.Column(db.Boolean, default=False)
    last_login = db.Column(db.DateTime)
    
    # Relationships
    transactions = db.relationship('Transaction', backref='user', lazy=True, cascade='all, delete-orphan')
    loans = db.relationship('Loan', backref='user', lazy=True, cascade='all, delete-orphan')
    investments = db.relationship('Investment', backref='user', lazy=True, cascade='all, delete-orphan')
    accounts = db.relationship('Account', backref='user', lazy=True, cascade='all, delete-orphan')
    budgets = db.relationship('Budget', backref='user', lazy=True, cascade='all, delete-orphan')
    categories = db.relationship('Category', backref='user', lazy=True, cascade='all, delete-orphan')
    notifications = db.relationship('Notification', backref='user', lazy=True, cascade='all, delete-orphan')
    currency_preferences = db.relationship('CurrencyPreference', backref='user', lazy=True, cascade='all, delete-orphan')

class Account(db.Model):
    __tablename__ = 'accounts'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)  # e.g., "Chase Checking", "Savings Account"
    account_type = db.Column(db.String(50), nullable=False)  # checking, savings, credit_card, investment, cash
    account_number = db.Column(db.String(50))  # Masked/partial account number
    bank_name = db.Column(db.String(100))
    balance = db.Column(db.Float, default=0.0)
    currency = db.Column(db.String(3), default='USD')
    is_primary = db.Column(db.Boolean, default=False)  # Primary account for transactions
    is_active = db.Column(db.Boolean, default=True)
    credit_limit = db.Column(db.Float)  # For credit cards
    interest_rate = db.Column(db.Float)  # Annual interest rate
    opening_date = db.Column(db.Date)
    notes = db.Column(db.Text)
    icon = db.Column(db.String(50), default='bank')
    color = db.Column(db.String(7), default='#2196F3')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_synced = db.Column(db.Boolean, default=False)
    
    # Relationships
    transactions = db.relationship('Transaction', foreign_keys='Transaction.account_id', backref='account', lazy=True)
    transfers_to = db.relationship('Transaction', foreign_keys='Transaction.transfer_to_account_id', backref='transfer_to_account', lazy=True)
    transfers_from = db.relationship('Transaction', foreign_keys='Transaction.transfer_from_account_id', backref='transfer_from_account', lazy=True)

class Transaction(db.Model):
    __tablename__ = 'transactions'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    account_id = db.Column(db.String(36), db.ForeignKey('accounts.id'))  # Link to account
    amount = db.Column(db.Float, nullable=False)
    currency = db.Column(db.String(3), default='USD')
    date = db.Column(db.Date, nullable=False)
    category = db.Column(db.String(50), nullable=False)
    subcategory = db.Column(db.String(50))  # Optional subcategory
    note = db.Column(db.Text)
    reference_number = db.Column(db.String(50))  # Transaction reference/check number
    location = db.Column(db.String(200))  # Where transaction occurred
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_synced = db.Column(db.Boolean, default=False)
    
    # Transaction types and status
    transaction_type = db.Column(db.String(20), default='regular')  # regular, transfer, loan, investment
    status = db.Column(db.String(20), default='completed')  # pending, completed, cancelled
    is_recurring = db.Column(db.Boolean, default=False)
    recurring_frequency = db.Column(db.String(20))  # daily, weekly, monthly, yearly
    
    # For transfers between accounts
    transfer_to_account_id = db.Column(db.String(36), db.ForeignKey('accounts.id'))
    transfer_from_account_id = db.Column(db.String(36), db.ForeignKey('accounts.id'))
    
    # Foreign keys for linked records
    loan_id = db.Column(db.String(36), db.ForeignKey('loans.id'))
    investment_id = db.Column(db.String(36), db.ForeignKey('investments.id'))
    budget_id = db.Column(db.String(36), db.ForeignKey('budgets.id'))

class Budget(db.Model):
    __tablename__ = 'budgets'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)  # Budget name
    category = db.Column(db.String(50), nullable=False)  # Category to budget for
    amount = db.Column(db.Float, nullable=False)  # Budget amount
    currency = db.Column(db.String(3), default='USD')
    period = db.Column(db.String(20), default='monthly')  # daily, weekly, monthly, yearly
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date)  # Optional end date
    spent_amount = db.Column(db.Float, default=0.0)  # Amount spent in current period
    remaining_amount = db.Column(db.Float, default=0.0)  # Remaining budget
    alert_threshold = db.Column(db.Float, default=80.0)  # Percentage to trigger alert
    is_active = db.Column(db.Boolean, default=True)
    auto_rollover = db.Column(db.Boolean, default=False)  # Roll unused budget to next period
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    transactions = db.relationship('Transaction', backref='budget', lazy=True)
    alerts = db.relationship('BudgetAlert', backref='budget', lazy=True, cascade='all, delete-orphan')

class BudgetAlert(db.Model):
    __tablename__ = 'budget_alerts'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    budget_id = db.Column(db.String(36), db.ForeignKey('budgets.id'), nullable=False)
    alert_type = db.Column(db.String(20), nullable=False)  # threshold, exceeded, depleted
    percentage_used = db.Column(db.Float, nullable=False)
    amount_spent = db.Column(db.Float, nullable=False)
    triggered_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_read = db.Column(db.Boolean, default=False)
    message = db.Column(db.Text)

class Loan(db.Model):
    __tablename__ = 'loans'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    loan_type = db.Column(db.String(10), nullable=False)  # given/taken
    amount = db.Column(db.Float, nullable=False)
    currency = db.Column(db.String(3), default='USD')
    contact = db.Column(db.String(100))
    contact_phone = db.Column(db.String(20))
    contact_email = db.Column(db.String(120))
    status = db.Column(db.String(20), default='outstanding')  # outstanding/paid/defaulted
    date = db.Column(db.Date, nullable=False)
    deadline = db.Column(db.Date)
    interest_rate = db.Column(db.Float, default=0.0)  # Annual percentage
    compound_frequency = db.Column(db.String(20), default='monthly')  # For compound interest
    payment_frequency = db.Column(db.String(20))  # monthly, quarterly, etc.
    minimum_payment = db.Column(db.Float)
    total_paid = db.Column(db.Float, default=0.0)
    remaining_balance = db.Column(db.Float)
    penalty_rate = db.Column(db.Float)  # Late payment penalty
    collateral = db.Column(db.String(200))  # Collateral description
    purpose = db.Column(db.String(200))  # Loan purpose
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_synced = db.Column(db.Boolean, default=False)
    
    # Relationships
    payments = db.relationship('LoanPayment', backref='loan', lazy=True, cascade='all, delete-orphan')
    transactions = db.relationship('Transaction', backref='loan', lazy=True)

class LoanPayment(db.Model):
    __tablename__ = 'loan_payments'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    loan_id = db.Column(db.String(36), db.ForeignKey('loans.id'), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    payment_date = db.Column(db.Date, nullable=False)
    principal_amount = db.Column(db.Float, default=0.0)
    interest_amount = db.Column(db.Float, default=0.0)
    penalty_amount = db.Column(db.Float, default=0.0)
    payment_method = db.Column(db.String(50))  # cash, check, transfer, etc.
    reference_number = db.Column(db.String(50))
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Investment(db.Model):
    __tablename__ = 'investments'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)  # Investment name/title
    symbol = db.Column(db.String(20))  # Stock symbol, crypto symbol
    platform = db.Column(db.String(100))  # Investment platform/broker
    investment_type = db.Column(db.String(50), default='stocks')  # stocks, crypto, bonds, real_estate, mutual_funds
    asset_class = db.Column(db.String(50))  # equity, fixed_income, commodity, etc.
    initial_amount = db.Column(db.Float, nullable=False)
    current_value = db.Column(db.Float)  # Updated value
    quantity = db.Column(db.Float)  # Number of shares/units
    purchase_price = db.Column(db.Float)  # Price per unit at purchase
    current_price = db.Column(db.Float)  # Current price per unit
    expected_roi = db.Column(db.Float)  # Expected annual ROI percentage
    actual_roi = db.Column(db.Float)  # Calculated actual ROI
    currency = db.Column(db.String(3), default='USD')
    purchase_date = db.Column(db.Date, nullable=False)
    maturity_date = db.Column(db.Date)  # Expected or actual maturity
    status = db.Column(db.String(20), default='active')  # active, matured, sold, partial_sold
    risk_level = db.Column(db.String(20))  # low, medium, high
    dividend_yield = db.Column(db.Float)  # Annual dividend yield
    expense_ratio = db.Column(db.Float)  # For mutual funds/ETFs
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_synced = db.Column(db.Boolean, default=False)
    
    # Relationships
    roi_entries = db.relationship('ROIEntry', backref='investment', lazy=True, cascade='all, delete-orphan')
    dividends = db.relationship('Dividend', backref='investment', lazy=True, cascade='all, delete-orphan')
    transactions = db.relationship('Transaction', backref='investment', lazy=True)

class ROIEntry(db.Model):
    __tablename__ = 'roi_entries'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    investment_id = db.Column(db.String(36), db.ForeignKey('investments.id'), nullable=False)
    recorded_value = db.Column(db.Float, nullable=False)  # Total value at this point
    price_per_unit = db.Column(db.Float)  # Price per share/unit
    quantity = db.Column(db.Float)  # Number of units
    roi_percentage = db.Column(db.Float)  # ROI at this point
    gain_loss = db.Column(db.Float)  # Total gain/loss amount
    entry_date = db.Column(db.Date, nullable=False)
    note = db.Column(db.Text)
    data_source = db.Column(db.String(50), default='manual')  # manual, api, imported
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Dividend(db.Model):
    __tablename__ = 'dividends'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    investment_id = db.Column(db.String(36), db.ForeignKey('investments.id'), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    dividend_per_share = db.Column(db.Float)
    shares_held = db.Column(db.Float)
    payment_date = db.Column(db.Date, nullable=False)
    ex_dividend_date = db.Column(db.Date)
    currency = db.Column(db.String(3), default='USD')
    is_reinvested = db.Column(db.Boolean, default=False)
    tax_withheld = db.Column(db.Float, default=0.0)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Category(db.Model):
    __tablename__ = 'categories'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    name = db.Column(db.String(50), nullable=False)
    parent_category_id = db.Column(db.String(36), db.ForeignKey('categories.id'))  # For subcategories
    color = db.Column(db.String(7), nullable=False)  # Hex color
    icon = db.Column(db.String(50), default='ellipsis-horizontal')
    type = db.Column(db.String(10), nullable=False)  # income/expense
    is_system = db.Column(db.Boolean, default=False)  # System vs user-created categories
    is_active = db.Column(db.Boolean, default=True)
    sort_order = db.Column(db.Integer, default=0)
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Self-referencing relationship for subcategories
    subcategories = db.relationship('Category', backref=db.backref('parent', remote_side=[id]), lazy=True)

class Currency(db.Model):
    __tablename__ = 'currencies'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    code = db.Column(db.String(3), unique=True, nullable=False)  # USD, EUR, NPR
    name = db.Column(db.String(50), nullable=False)  # US Dollar, Euro, Nepalese Rupee
    symbol = db.Column(db.String(10), nullable=False)  # $, €, ₹
    country = db.Column(db.String(50))  # Country/region
    decimal_places = db.Column(db.Integer, default=2)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class ExchangeRate(db.Model):
    __tablename__ = 'exchange_rates'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    from_currency = db.Column(db.String(3), nullable=False)
    to_currency = db.Column(db.String(3), nullable=False)
    rate = db.Column(db.Float, nullable=False)
    date = db.Column(db.Date, nullable=False)
    source = db.Column(db.String(50), default='manual')  # manual, api, bank
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Composite index for efficient lookups
    __table_args__ = (
        db.Index('idx_exchange_rate_lookup', 'from_currency', 'to_currency', 'date'),
    )

class CurrencyPreference(db.Model):
    __tablename__ = 'currency_preferences'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    currency_code = db.Column(db.String(3), nullable=False)
    is_primary = db.Column(db.Boolean, default=False)
    display_order = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Notification(db.Model):
    __tablename__ = 'notifications'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    message = db.Column(db.Text, nullable=False)
    type = db.Column(db.String(50), nullable=False)  # budget_alert, loan_reminder, investment_update
    category = db.Column(db.String(50))  # info, warning, error, success
    is_read = db.Column(db.Boolean, default=False)
    is_email_sent = db.Column(db.Boolean, default=False)
    is_push_sent = db.Column(db.Boolean, default=False)
    data = db.Column(db.Text)  # JSON data for additional info
    expires_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    read_at = db.Column(db.DateTime)

class RecurringTransaction(db.Model):
    __tablename__ = 'recurring_transactions'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    account_id = db.Column(db.String(36), db.ForeignKey('accounts.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)  # e.g., "Netflix Subscription"
    amount = db.Column(db.Float, nullable=False)
    currency = db.Column(db.String(3), default='USD')
    category = db.Column(db.String(50), nullable=False)
    frequency = db.Column(db.String(20), nullable=False)  # daily, weekly, monthly, yearly
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date)  # Optional end date
    next_occurrence = db.Column(db.Date, nullable=False)
    last_created = db.Column(db.Date)
    is_active = db.Column(db.Boolean, default=True)
    auto_create = db.Column(db.Boolean, default=True)  # Auto-create transactions
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Goal(db.Model):
    __tablename__ = 'goals'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)  # e.g., "Emergency Fund", "Vacation"
    description = db.Column(db.Text)
    target_amount = db.Column(db.Float, nullable=False)
    current_amount = db.Column(db.Float, default=0.0)
    currency = db.Column(db.String(3), default='USD')
    target_date = db.Column(db.Date)
    category = db.Column(db.String(50))  # emergency, vacation, investment, etc.
    priority = db.Column(db.String(20), default='medium')  # low, medium, high
    status = db.Column(db.String(20), default='active')  # active, completed, paused, cancelled
    auto_contribute = db.Column(db.Boolean, default=False)
    contribution_amount = db.Column(db.Float)  # Amount to auto-contribute
    contribution_frequency = db.Column(db.String(20))  # monthly, weekly, etc.
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = db.Column(db.DateTime)

class GoalTransaction(db.Model):
    __tablename__ = 'goal_transactions'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    goal_id = db.Column(db.String(36), db.ForeignKey('goals.id'), nullable=False)
    transaction_id = db.Column(db.String(36), db.ForeignKey('transactions.id'), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    transaction_type = db.Column(db.String(20), nullable=False)  # contribution, withdrawal
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class SyncLog(db.Model):
    __tablename__ = 'sync_logs'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    device_id = db.Column(db.String(100))
    sync_type = db.Column(db.String(50), nullable=False)  # full, incremental, pull, push
    table_name = db.Column(db.String(50))  # Which table was synced
    records_affected = db.Column(db.Integer, default=0)
    last_sync_time = db.Column(db.DateTime, nullable=False)
    sync_status = db.Column(db.String(20), default='completed')  # completed, failed, partial
    error_message = db.Column(db.Text)
    device_info = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class ApiKey(db.Model):
    __tablename__ = 'api_keys'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)  # e.g., "Mobile App", "Web Dashboard"
    key_hash = db.Column(db.String(255), nullable=False)
    permissions = db.Column(db.Text)  # JSON array of permissions
    last_used = db.Column(db.DateTime)
    expires_at = db.Column(db.DateTime)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class AuditLog(db.Model):
    __tablename__ = 'audit_logs'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    action = db.Column(db.String(50), nullable=False)  # create, update, delete, login, etc.
    table_name = db.Column(db.String(50))
    record_id = db.Column(db.String(36))
    old_values = db.Column(db.Text)  # JSON of old values
    new_values = db.Column(db.Text)  # JSON of new values
    ip_address = db.Column(db.String(50))
    user_agent = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
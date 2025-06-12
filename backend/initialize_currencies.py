from models.models import db, Currency, ExchangeRate
from datetime import datetime

def initialize_currencies():
    """Initialize currency data with major world currencies"""
    
    currencies_data = [
        # Major currencies
        {'code': 'USD', 'name': 'US Dollar', 'symbol': '$', 'country': 'United States'},
        {'code': 'EUR', 'name': 'Euro', 'symbol': '€', 'country': 'Eurozone'},
        {'code': 'GBP', 'name': 'British Pound', 'symbol': '£', 'country': 'United Kingdom'},
        {'code': 'JPY', 'name': 'Japanese Yen', 'symbol': '¥', 'country': 'Japan', 'decimal_places': 0},
        {'code': 'CAD', 'name': 'Canadian Dollar', 'symbol': 'C$', 'country': 'Canada'},
        {'code': 'AUD', 'name': 'Australian Dollar', 'symbol': 'A$', 'country': 'Australia'},
        {'code': 'CHF', 'name': 'Swiss Franc', 'symbol': 'CHF', 'country': 'Switzerland'},
        
        # Asian currencies
        {'code': 'CNY', 'name': 'Chinese Yuan', 'symbol': '¥', 'country': 'China'},
        {'code': 'INR', 'name': 'Indian Rupee', 'symbol': '₹', 'country': 'India'},
        {'code': 'NPR', 'name': 'Nepalese Rupee', 'symbol': 'Rs.', 'country': 'Nepal'},
        {'code': 'PKR', 'name': 'Pakistani Rupee', 'symbol': 'Rs', 'country': 'Pakistan'},
        {'code': 'BDT', 'name': 'Bangladeshi Taka', 'symbol': '৳', 'country': 'Bangladesh'},
        {'code': 'LKR', 'name': 'Sri Lankan Rupee', 'symbol': 'Rs', 'country': 'Sri Lanka'},
        {'code': 'KRW', 'name': 'South Korean Won', 'symbol': '₩', 'country': 'South Korea', 'decimal_places': 0},
        {'code': 'SGD', 'name': 'Singapore Dollar', 'symbol': 'S$', 'country': 'Singapore'},
        {'code': 'HKD', 'name': 'Hong Kong Dollar', 'symbol': 'HK$', 'country': 'Hong Kong'},
        {'code': 'THB', 'name': 'Thai Baht', 'symbol': '฿', 'country': 'Thailand'},
        {'code': 'MYR', 'name': 'Malaysian Ringgit', 'symbol': 'RM', 'country': 'Malaysia'},
        {'code': 'IDR', 'name': 'Indonesian Rupiah', 'symbol': 'Rp', 'country': 'Indonesia', 'decimal_places': 0},
        {'code': 'PHP', 'name': 'Philippine Peso', 'symbol': '₱', 'country': 'Philippines'},
        {'code': 'VND', 'name': 'Vietnamese Dong', 'symbol': '₫', 'country': 'Vietnam', 'decimal_places': 0},
        
        # Middle East & Africa
        {'code': 'AED', 'name': 'UAE Dirham', 'symbol': 'د.إ', 'country': 'United Arab Emirates'},
        {'code': 'SAR', 'name': 'Saudi Riyal', 'symbol': '﷼', 'country': 'Saudi Arabia'},
        {'code': 'QAR', 'name': 'Qatari Riyal', 'symbol': 'ر.ق', 'country': 'Qatar'},
        {'code': 'EGP', 'name': 'Egyptian Pound', 'symbol': '£', 'country': 'Egypt'},
        {'code': 'ZAR', 'name': 'South African Rand', 'symbol': 'R', 'country': 'South Africa'},
        {'code': 'NGN', 'name': 'Nigerian Naira', 'symbol': '₦', 'country': 'Nigeria'},
        
        # Americas
        {'code': 'BRL', 'name': 'Brazilian Real', 'symbol': 'R$', 'country': 'Brazil'},
        {'code': 'MXN', 'name': 'Mexican Peso', 'symbol': '$', 'country': 'Mexico'},
        {'code': 'ARS', 'name': 'Argentine Peso', 'symbol': '$', 'country': 'Argentina'},
        {'code': 'CLP', 'name': 'Chilean Peso', 'symbol': '$', 'country': 'Chile', 'decimal_places': 0},
        {'code': 'COP', 'name': 'Colombian Peso', 'symbol': '$', 'country': 'Colombia'},
        
        # European
        {'code': 'NOK', 'name': 'Norwegian Krone', 'symbol': 'kr', 'country': 'Norway'},
        {'code': 'SEK', 'name': 'Swedish Krona', 'symbol': 'kr', 'country': 'Sweden'},
        {'code': 'DKK', 'name': 'Danish Krone', 'symbol': 'kr', 'country': 'Denmark'},
        {'code': 'PLN', 'name': 'Polish Zloty', 'symbol': 'zł', 'country': 'Poland'},
        {'code': 'CZK', 'name': 'Czech Koruna', 'symbol': 'Kč', 'country': 'Czech Republic'},
        {'code': 'HUF', 'name': 'Hungarian Forint', 'symbol': 'Ft', 'country': 'Hungary', 'decimal_places': 0},
        {'code': 'RUB', 'name': 'Russian Ruble', 'symbol': '₽', 'country': 'Russia'},
        
        # Crypto (for users who track crypto)
        {'code': 'BTC', 'name': 'Bitcoin', 'symbol': '₿', 'country': 'Global', 'decimal_places': 8},
        {'code': 'ETH', 'name': 'Ethereum', 'symbol': 'Ξ', 'country': 'Global', 'decimal_places': 6},
    ]
    
    for currency_data in currencies_data:
        # Check if currency already exists
        existing = Currency.query.filter_by(code=currency_data['code']).first()
        if not existing:
            currency = Currency(
                code=currency_data['code'],
                name=currency_data['name'],
                symbol=currency_data['symbol'],
                country=currency_data['country'],
                decimal_places=currency_data.get('decimal_places', 2),
                is_active=True
            )
            db.session.add(currency)
    
    db.session.commit()
    print("✅ Currency data initialized successfully!")

def get_country_currency_mapping():
    """Return mapping of countries to their default currencies"""
    return {
        'United States': 'USD',
        'Canada': 'CAD',
        'United Kingdom': 'GBP',
        'Australia': 'AUD',
        'Germany': 'EUR',
        'France': 'EUR',
        'Italy': 'EUR',
        'Spain': 'EUR',
        'Netherlands': 'EUR',
        'Japan': 'JPY',
        'China': 'CNY',
        'India': 'INR',
        'Nepal': 'NPR',
        'Pakistan': 'PKR',
        'Bangladesh': 'BDT',
        'Sri Lanka': 'LKR',
        'South Korea': 'KRW',
        'Singapore': 'SGD',
        'Thailand': 'THB',
        'Malaysia': 'MYR',
        'Indonesia': 'IDR',
        'Philippines': 'PHP',
        'Vietnam': 'VND',
        'Brazil': 'BRL',
        'Mexico': 'MXN',
        'Argentina': 'ARS',
        'South Africa': 'ZAR',
        'Nigeria': 'NGN',
        'Egypt': 'EGP',
        'United Arab Emirates': 'AED',
        'Saudi Arabia': 'SAR',
        'Switzerland': 'CHF',
        'Norway': 'NOK',
        'Sweden': 'SEK',
        'Denmark': 'DKK',
        'Poland': 'PLN',
        'Russia': 'RUB',
    }

if __name__ == "__main__":
    initialize_currencies()
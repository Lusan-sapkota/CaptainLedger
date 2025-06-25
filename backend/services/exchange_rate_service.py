import os
from typing import Optional, Dict, Any
import requests
import logging
from datetime import datetime, timedelta
from models.models import db, ExchangeRate

logger = logging.getLogger(__name__)

class ExchangeRateService:
    """Service for fetching and managing exchange rates"""
    
    def __init__(self):
        self.api_key = os.getenv('EXCHANGE_RATE_API_KEY')
        self.base_url = "https://v6.exchangerate-api.com/v6"
        self.fallback_url = "https://api.exchangerate-api.com/v4/latest"
        
    def get_exchange_rate(self, from_currency: str, to_currency: str) -> Optional[float]:
        """Get exchange rate between two currencies"""
        if from_currency == to_currency:
            return 1.0
            
        # Try to get from database first (cache for 1 hour)
        cached_rate = self._get_cached_rate(from_currency, to_currency)
        if cached_rate:
            return cached_rate
            
        # Fetch from API
        rate = self._fetch_from_api(from_currency, to_currency)
        
        if rate:
            # Cache the rate
            self._cache_rate(from_currency, to_currency, rate)
            return rate
            
        # Try fallback
        return self._fetch_fallback(from_currency, to_currency)
    
    def _get_cached_rate(self, from_currency: str, to_currency: str) -> Optional[float]:
        """Get cached exchange rate with enhanced intelligent fallback strategy"""
        try:
            # First try: Look for rate within the last 6 hours (extended for better reliability)
            cutoff_time = datetime.utcnow() - timedelta(hours=6)
            
            rate_record = ExchangeRate.query.filter(
                ExchangeRate.from_currency == from_currency,
                ExchangeRate.to_currency == to_currency,
                ExchangeRate.created_at > cutoff_time
            ).first()
            
            if rate_record:
                logger.info(f"Using fresh cached rate: {from_currency}/{to_currency} = {rate_record.rate}")
                return rate_record.rate
            
            # Second try: Look for any rate within the last 48 hours as fallback (extended)
            fallback_cutoff = datetime.utcnow() - timedelta(hours=48)
            
            fallback_record = ExchangeRate.query.filter(
                ExchangeRate.from_currency == from_currency,
                ExchangeRate.to_currency == to_currency,
                ExchangeRate.created_at > fallback_cutoff
            ).order_by(ExchangeRate.created_at.desc()).first()
            
            if fallback_record:
                logger.info(f"Using fallback cached rate: {from_currency}/{to_currency} = {fallback_record.rate} (age: {datetime.utcnow() - fallback_record.created_at})")
                return fallback_record.rate
                
            # Third try: Look for reverse rate (EUR/USD when USD/EUR requested)
            reverse_record = ExchangeRate.query.filter(
                ExchangeRate.from_currency == to_currency,
                ExchangeRate.to_currency == from_currency,
                ExchangeRate.created_at > fallback_cutoff
            ).order_by(ExchangeRate.created_at.desc()).first()
            
            if reverse_record and reverse_record.rate != 0:
                reverse_rate = 1.0 / reverse_record.rate
                logger.info(f"Using reverse cached rate: {from_currency}/{to_currency} = {reverse_rate} (calculated from {to_currency}/{from_currency})")
                # Cache the calculated reverse rate
                self._cache_rate(from_currency, to_currency, reverse_rate, 'calculated')
                return reverse_rate
            
            # Fourth try: Look for USD bridge rates (e.g., EUR->USD->JPY)
            if from_currency != 'USD' and to_currency != 'USD':
                usd_from_record = ExchangeRate.query.filter(
                    ExchangeRate.from_currency == from_currency,
                    ExchangeRate.to_currency == 'USD',
                    ExchangeRate.created_at > fallback_cutoff
                ).order_by(ExchangeRate.created_at.desc()).first()
                
                usd_to_record = ExchangeRate.query.filter(
                    ExchangeRate.from_currency == 'USD',
                    ExchangeRate.to_currency == to_currency,
                    ExchangeRate.created_at > fallback_cutoff
                ).order_by(ExchangeRate.created_at.desc()).first()
                
                if usd_from_record and usd_to_record:
                    bridge_rate = usd_from_record.rate * usd_to_record.rate
                    logger.info(f"Using USD bridge rate: {from_currency}/{to_currency} = {bridge_rate} (via USD)")
                    # Cache the calculated bridge rate
                    self._cache_rate(from_currency, to_currency, bridge_rate, 'calculated_bridge')
                    return bridge_rate
                
        except Exception as e:
            logger.error(f"Error getting cached rate: {e}")
            
        return None
    
    def _fetch_from_api(self, from_currency: str, to_currency: str) -> Optional[float]:
        """Fetch exchange rate from primary API"""
        if not self.api_key:
            logger.warning("No API key configured for exchange rates")
            return None
            
        try:
            url = f"{self.base_url}/{self.api_key}/pair/{from_currency}/{to_currency}"
            
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            
            if data.get('result') == 'success':
                rate = float(data.get('conversion_rate', 1.0))
                logger.info(f"Fetched rate from API: {from_currency}/{to_currency} = {rate}")
                return rate
            else:
                logger.error(f"API error: {data.get('error-type', 'unknown')}")
                return None
                
        except requests.exceptions.Timeout:
            logger.error("API request timeout")
            return None
        except requests.exceptions.RequestException as e:
            logger.error(f"API request error: {e}")
            return None
        except (ValueError, KeyError) as e:
            logger.error(f"API response parsing error: {e}")
            return None
            
    def _fetch_fallback(self, from_currency: str, to_currency: str) -> Optional[float]:
        """Fetch from fallback API (free, no key required)"""
        try:
            url = f"{self.fallback_url}/{from_currency}"
            
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            rates = data.get('rates', {})
            
            if to_currency in rates:
                rate = float(rates[to_currency])
                logger.info(f"Fetched rate from fallback: {from_currency}/{to_currency} = {rate}")
                return rate
                
        except Exception as e:
            logger.error(f"Fallback API error: {e}")
            
        # Final fallback - try to get any historical rate
        return self._get_historical_rate(from_currency, to_currency)
    
    def _get_historical_rate(self, from_currency: str, to_currency: str) -> Optional[float]:
        """Get the most recent historical rate as last resort"""
        try:
            rate_record = ExchangeRate.query.filter(
                ExchangeRate.from_currency == from_currency,
                ExchangeRate.to_currency == to_currency
            ).order_by(ExchangeRate.created_at.desc()).first()
            
            if rate_record:
                logger.info(f"Using historical rate: {from_currency}/{to_currency} = {rate_record.rate}")
                return rate_record.rate
                
        except Exception as e:
            logger.error(f"Error getting historical rate: {e}")
            
        # Ultimate fallback
        logger.warning(f"No exchange rate available for {from_currency}/{to_currency}, using 1.0")
        return 1.0
    
    def _cache_rate(self, from_currency: str, to_currency: str, rate: float, source: str = 'api'):
        """Cache exchange rate in database with enhanced retention strategy"""
        try:
            # Keep more historical data for better fallbacks - increase to 20 rates per pair
            existing_count = ExchangeRate.query.filter(
                ExchangeRate.from_currency == from_currency,
                ExchangeRate.to_currency == to_currency
            ).count()
            
            if existing_count >= 20:
                # Remove oldest rates, keep 19 most recent
                oldest_rates = ExchangeRate.query.filter(
                    ExchangeRate.from_currency == from_currency,
                    ExchangeRate.to_currency == to_currency
                ).order_by(ExchangeRate.created_at.asc()).limit(existing_count - 19).all()
                
                for old_rate in oldest_rates:
                    db.session.delete(old_rate)
            
            # Add new rate
            new_rate = ExchangeRate(
                from_currency=from_currency,
                to_currency=to_currency,
                rate=rate,
                source=source,
                date=datetime.utcnow().date(),
                created_at=datetime.utcnow()
            )
            
            db.session.add(new_rate)
            db.session.commit()
            
            logger.info(f"Cached rate: {from_currency}/{to_currency} = {rate} (source: {source})")
            
        except Exception as e:
            logger.error(f"Error caching rate: {e}")
            db.session.rollback()
    
    def get_supported_currencies(self) -> Dict[str, Any]:
        """Get list of supported currencies"""
        if not self.api_key:
            return self._get_default_currencies()
            
        try:
            url = f"{self.base_url}/{self.api_key}/codes"
            
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            
            if data.get('result') == 'success':
                return {
                    'currencies': data.get('supported_codes', []),
                    'source': 'api'
                }
                
        except Exception as e:
            logger.error(f"Error fetching supported currencies: {e}")
            
        return self._get_default_currencies()
    
    def _get_default_currencies(self) -> Dict[str, Any]:
        """Get default supported currencies list"""
        return {
            'currencies': [
                ['USD', 'US Dollar'],
                ['EUR', 'Euro'],
                ['GBP', 'British Pound Sterling'],
                ['JPY', 'Japanese Yen'],
                ['CAD', 'Canadian Dollar'],
                ['AUD', 'Australian Dollar'],
                ['CHF', 'Swiss Franc'],
                ['CNY', 'Chinese Yuan'],
                ['INR', 'Indian Rupee'],
                ['NPR', 'Nepalese Rupee'],
                # Add more as needed
            ],
            'source': 'default'
        }
    
    def convert_amount(self, amount: float, from_currency: str, to_currency: str) -> Optional[float]:
        """Convert an amount from one currency to another"""
        if not amount or amount == 0:
            return 0.0
            
        rate = self.get_exchange_rate(from_currency, to_currency)
        if rate is None:
            logger.warning(f"Could not get exchange rate for {from_currency} to {to_currency}")
            return None
            
        return amount * rate

# Global instance
exchange_rate_service = ExchangeRateService()

# Currency Conversion System Implementation

## Overview
This document outlines the comprehensive real-time currency conversion system implemented for Captain Ledger, providing centralized currency management with offline support and robust error handling.

## Architecture Components

### 1. Backend Exchange Rate Service (`/backend/services/exchange_rate_service.py`)
- **Purpose**: Centralized service for fetching and caching exchange rates
- **Features**:
  - Multi-API support with fallback mechanisms
  - Rate caching (1-hour cache for performance)
  - Database storage for offline access
  - Error handling and retry logic

### 2. Currency API Endpoints (`/backend/api/currencies.py`)
- **Endpoints**:
  - `GET /currencies` - Get all available currencies
  - `GET /currencies/preferences` - Get user currency preferences
  - `POST /currencies/preferences` - Set user primary currency
  - `GET /currencies/exchange-rate` - Get exchange rate between two currencies
  - `POST /currencies/convert-bulk` - Bulk currency conversion for efficiency

### 3. Frontend Currency Service (`/frontend/services/currencyService.ts`)
- **Features**:
  - Currency data caching (24 hours for currency list, 1 hour for rates)
  - Exchange rate fetching with fallback to offline rates
  - Currency formatting with proper symbols and decimal places
  - Bulk conversion support for efficient processing
  - Country-based default currency mapping

### 4. Currency Conversion Manager (`/frontend/services/currencyConversionManager.ts`)
- **Purpose**: Centralized manager for real-time currency conversions
- **Features**:
  - Network connectivity monitoring
  - Offline queue management with persistent storage
  - Bulk conversion of transactions, budgets, loans, and investments
  - Progress tracking and status management
  - Automatic processing when connectivity is restored

### 5. Currency Provider (`/frontend/components/CurrencyProvider.tsx`)
- **Features**:
  - Global currency state management
  - Real-time conversion request handling
  - Network status monitoring
  - Integration with conversion manager

### 6. Currency Settings Modal (`/frontend/components/CurrencySettingsModal.tsx`)
- **Features**:
  - Currency selection interface
  - Connectivity status indicators
  - Offline mode notifications
  - Conversion confirmation dialogs

## Key Features Implemented

### 1. Default Currency Assignment
- **Location**: `/backend/api/auth.py` (user registration)
- **Implementation**: Automatic currency assignment based on user's selected country
- **Mapping**: Uses comprehensive country-to-currency mapping
- **Process**:
  1. User selects country during registration
  2. System looks up default currency for that country
  3. Sets user's `preferred_currency` field
  4. Creates default `CurrencyPreference` record

### 2. Real-Time Currency Conversion
- **Trigger**: When user changes preferred currency in settings
- **Process**:
  1. Check network connectivity
  2. Show confirmation dialog if online
  3. Queue conversion if offline
  4. Convert all user data (transactions, budgets, loans, investments)
  5. Update database with converted amounts
  6. Update UI with new currency formatting

### 3. Offline Support
- **Queue Storage**: Persistent storage using AsyncStorage
- **Network Detection**: Real-time monitoring with NetInfo
- **Auto-Processing**: Automatic queue processing when connectivity restored
- **User Feedback**: Clear indicators for offline mode and pending conversions

### 4. Bulk Conversion Optimization
- **Backend Endpoint**: `/currencies/convert-bulk`
- **Benefits**: Reduces API calls and improves performance
- **Error Handling**: Individual item error tracking
- **Fallback**: Individual conversions if bulk fails

## Database Schema Updates

### Currency Table
```sql
CREATE TABLE currencies (
    id VARCHAR(36) PRIMARY KEY,
    code VARCHAR(3) UNIQUE NOT NULL,
    name VARCHAR(50) NOT NULL,
    symbol VARCHAR(10) NOT NULL,
    country VARCHAR(50),
    decimal_places INTEGER DEFAULT 2,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Exchange Rate Table
```sql
CREATE TABLE exchange_rates (
    id VARCHAR(36) PRIMARY KEY,
    from_currency VARCHAR(3) NOT NULL,
    to_currency VARCHAR(3) NOT NULL,
    rate FLOAT NOT NULL,
    date DATE NOT NULL,
    source VARCHAR(50) DEFAULT 'manual',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Currency Preference Table
```sql
CREATE TABLE currency_preferences (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    currency_code VARCHAR(3) NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    display_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

## Configuration

### Environment Variables
Create `/backend/.env` file with:
```env
# Exchange Rate API Configuration
EXCHANGE_RATE_API_KEY=your_api_key_here

# Other configurations...
```

### API Key Setup
1. Sign up at https://app.exchangerate-api.com/sign-up
2. Get your free API key
3. Add to environment variables
4. Service will fallback to free APIs if key not provided

## Usage Examples

### Frontend: Convert User's Currency
```typescript
import { useCurrency } from '@/components/CurrencyProvider';

const { requestCurrencyChange, isOnline } = useCurrency();

// Request currency change
const success = await requestCurrencyChange('USD', 'EUR', true);
if (success) {
  console.log('Currency conversion completed');
}
```

### Frontend: Format Currency Amount
```typescript
import currencyService from '@/services/currencyService';

// Format amount with proper currency symbol
const formatted = await currencyService.formatCurrency(100.50, 'USD');
console.log(formatted); // "$100.50"
```

### Backend: Bulk Currency Conversion
```python
# POST /currencies/convert-bulk
{
  "conversions": [
    {
      "item_id": "transaction_1",
      "item_type": "transaction",
      "amount": 100.00,
      "from_currency": "USD",
      "to_currency": "EUR"
    }
  ]
}
```

## Error Handling

### Network Errors
- Automatic retry with exponential backoff
- Graceful fallback to cached rates
- User-friendly error messages

### Conversion Errors
- Individual item error tracking in bulk operations
- Fallback to original amounts when conversion fails
- Detailed error logging for debugging

### Rate Limiting
- Built-in caching to reduce API calls
- Fallback to free APIs when rate limits hit
- Queue management for offline scenarios

## Testing

### Backend Testing
```bash
cd /home/lusan/Documents/CaptainLedger/backend
python -m pytest tests/ -v
```

### Frontend Testing
```bash
cd /home/lusan/Documents/CaptainLedger/frontend
npm test
```

## Performance Considerations

### Caching Strategy
- Exchange rates cached for 1 hour
- Currency list cached for 24 hours
- Database caching for offline access

### Batch Processing
- Bulk conversion reduces API calls
- Queue processing for offline scenarios
- Progress tracking for user feedback

### Memory Management
- Automatic cache cleanup
- Efficient queue storage
- Proper event listener cleanup

## Security Considerations

### API Key Security
- Environment variable storage
- Server-side API calls only
- Rate limiting protection

### Data Validation
- Currency code validation
- Amount range validation
- User authorization checks

## Monitoring and Logging

### Backend Logging
- Exchange rate fetch attempts
- Conversion success/failure rates
- Error tracking and debugging

### Frontend Logging
- Network status changes
- Conversion queue status
- User interaction tracking

## Future Enhancements

### Planned Features
1. Historical rate tracking
2. Currency trend analysis
3. Conversion cost tracking
4. Multi-currency portfolio view
5. Real-time rate notifications

### Scalability Improvements
1. Redis caching for high-traffic scenarios
2. Database sharding for large datasets
3. CDN integration for static currency data
4. Microservice architecture for rate fetching

## Support and Maintenance

### Regular Tasks
1. Monitor API rate limits
2. Update currency list quarterly
3. Review and update exchange rate sources
4. Performance monitoring and optimization

### Troubleshooting
1. Check network connectivity
2. Verify API key configuration
3. Review server logs for errors
4. Clear cache if rates seem stale

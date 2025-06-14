// Test currency service
import currencyService from './services/currencyService.js';

async function testCurrency() {
  try {
    console.log('Testing currency service...');
    
    // Test getting primary currency
    const primaryCurrency = await currencyService.getPrimaryCurrency();
    console.log('Primary currency:', primaryCurrency);
    
    // Test formatting
    const formatted = await currencyService.formatCurrency(1000, primaryCurrency);
    console.log('Formatted 1000:', formatted);
    
    // Test NPR specifically
    const nprFormatted = await currencyService.formatCurrency(1000, 'NPR');
    console.log('NPR formatted 1000:', nprFormatted);
    
  } catch (error) {
    console.error('Error testing currency:', error);
  }
}

testCurrency();

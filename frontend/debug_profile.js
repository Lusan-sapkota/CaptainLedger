// Debug script to test profile API endpoints
const axios = require('axios');

const testProfileAPI = async () => {
  const baseURL = 'http://192.168.18.2:5000/api';
  
  console.log('Testing profile API...');
  console.log('Base URL:', baseURL);
  
  try {
    // Test if server is reachable
    console.log('\n1. Testing server connectivity...');
    const healthCheck = await axios.get(`http://192.168.18.2:5000/health`, {
      timeout: 5000
    });
    console.log('Server is reachable:', healthCheck.status);
  } catch (error) {
    console.error('Server connectivity test failed:', error.message);
    console.error('Make sure your backend server is running on 192.168.18.2:5000');
    return;
  }
  
  try {
    // Test profile endpoint without auth (should return 401)
    console.log('\n2. Testing profile endpoint without auth...');
    const noAuthResponse = await axios.get(`${baseURL}/auth/profile`, {
      timeout: 5000
    });
    console.log('Unexpected success without auth:', noAuthResponse.status);
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.log('✓ Profile endpoint correctly requires authentication');
    } else {
      console.error('Unexpected error:', error.message);
    }
  }
  
  console.log('\n3. To test with auth, you need to:');
  console.log('   - Login to your app first');
  console.log('   - Copy the auth_token from AsyncStorage');
  console.log('   - Add it to this script');
  console.log('\nIf the server connectivity test failed, check:');
  console.log('   - Backend server is running: cd backend && python app.py');
  console.log('   - Firewall allows port 5000');
  console.log('   - IP address 192.168.18.2 is correct for your machine');
};

testProfileAPI();

// OneSignal Configuration Debug Script
// Run this to verify your OneSignal setup

require('dotenv').config();
const OneSignal = require('@onesignal/node-onesignal');


// Check environment variables


// Validate format
const appId = process.env.ONESIGNAL_APP_ID;
const apiKey = process.env.ONESIGNAL_REST_API_KEY;

if (appId) {
  const appIdFormat = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
} else {
}

if (apiKey) {
  // OneSignal REST API keys are typically longer strings
  console.log('   API Key format seems valid:', apiKey.length > 30);
} else {
  console.log('   ❌ REST API Key is missing!');
}

// Test OneSignal client creation
try {
  const app_key_provider = {
    getToken() {
      return process.env.ONESIGNAL_REST_API_KEY;
    }
  };

  const configuration = OneSignal.createConfiguration({
    authMethods: {
      app_key: {
        tokenProvider: app_key_provider
      }
    }
  });

  const client = new OneSignal.DefaultApi(configuration);

  // Test notification creation (without sending)
  const testNotification = new OneSignal.Notification();
  testNotification.app_id = appId;
  testNotification.include_player_ids = ['test-player-id'];
  testNotification.contents = { en: 'Test message' };
  testNotification.headings = { en: 'Test Title' };



} catch (error) {
  console.log('   ❌ Error creating OneSignal client:', error.message);
}



module.exports = {
  testConfiguration: () => {
    return {
      appId: !!process.env.ONESIGNAL_APP_ID,
      apiKey: !!process.env.ONESIGNAL_REST_API_KEY,
      appIdFormat: process.env.ONESIGNAL_APP_ID ? /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(process.env.ONESIGNAL_APP_ID) : false
    };
  }
};

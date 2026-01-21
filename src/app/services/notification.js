// const OneSignal = require("@onesignal/node-onesignal");
// const mongoose = require("mongoose");
// const Device = mongoose.model("Device");
// const Notification = mongoose.model("Notification");
// const User = mongoose.model("User");
// const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;

// const ONESIGNAL_REST_API_KEY = {
//   getToken() {
//     return process.env.ONESIGNAL_REST_API_KEY;
//   }
// };

// const configuration = OneSignal.createConfiguration({

//   restApiKey: process.env.ONESIGNAL_REST_API_KEY,
//   authMethods: {
//     rest_api_key: { tokenProvider: ONESIGNAL_REST_API_KEY }
//   }
// });
// const client = new OneSignal.DefaultApi(configuration);

// async function sendNotification(content, player_ids, title, track) {
//   try {
//     if (!player_ids || player_ids.length === 0) {
//       // console.log("No player IDs provided for notification");
//       return { success: false, message: "No player IDs provided" };
//     }

//     // Validate OneSignal configuration
//     if (!ONESIGNAL_APP_ID) {
//       throw new Error("OneSignal App ID is not configured");
//     }

//     if (!process.env.ONESIGNAL_REST_API_KEY) {
//       throw new Error("OneSignal REST API Key is not configured");
//     }

//     // console.log("OneSignal App ID:", ONESIGNAL_APP_ID);
//     // console.log("OneSignal API Key exists:", !!process.env.ONESIGNAL_REST_API_KEY);

//     const notification = new OneSignal.Notification();
//     notification.app_id = ONESIGNAL_APP_ID; // Fixed: Uncommented this line

//     // Use include_player_ids for player IDs (not subscription IDs)
//     notification.include_player_ids = player_ids;

//     notification.contents = {
//       en: content,
//     };

//     if (title) {
//       notification.headings = {
//         en: title,
//       };
//     }

//     // Add custom data for tracking
//     if (track) {
//       notification.data = { orderId: track };
//     }

//     notification.name = "Bách Hoá Houston";

//     // console.log("Sending notification with config:");
//     // console.log("- App ID:", notification.app_id);
//     // console.log("- Player IDs:", notification.include_player_ids);
//     // console.log("- Title:", notification.headings);
//     // console.log("- Content:", notification.contents);
//     // console.log("- Data:", notification.data);

//     const result = await client.createNotification(notification);
//     // console.log("Notification sent successfully:", result);
//     return result;
//   } catch (err) {
//     // console.log("error in send notification", content);
//     // console.error("error in send notification", err);

//     // Handle specific OneSignal errors
//     if (err.message && err.message.includes('text/plain is not supported by ObjectSerializer')) {
//       // console.error("OneSignal ObjectSerializer Error - This usually means:");
//       // console.error("1. Invalid App ID or REST API Key");
//       // console.error("2. OneSignal returned an error page instead of JSON");
//       // console.error("3. Network/firewall issues blocking the request");
//       // console.error("4. Missing required fields in notification object");

//       // Try to provide more context
//       // console.error("Current configuration:");
//       // console.error("- App ID:", ONESIGNAL_APP_ID);
//       // console.error("- API Key present:", !!process.env.ONESIGNAL_REST_API_KEY);
//       // console.error("- Player IDs:", player_ids);
//     }

//     if (err.code === 403) {
//       // console.error("OneSignal 403 Error - Check your API credentials:");
//       // console.error("- Verify ONESIGNAL_APP_ID is correct");
//       // console.error("- Verify ONESIGNAL_REST_API_KEY is correct");
//       // console.error("- Ensure the REST API Key has proper permissions");
//     }

//     // Return a more user-friendly error
//     const errorResponse = {
//       success: false,
//       message: "Failed to send notification",
//       error: err.message,
//       details: "Check OneSignal configuration and credentials"
//     };

//     return errorResponse;
//   }
// }
// async function findDevices(user) {
//   try {
//     const devices = await Device.find({ user, is_active: true });
//     // console.log("Found devices for user:", user, devices);

//     // Validate player IDs format
//     const player_ids = devices.map((d) => d.player_id).filter(id => {
//       if (!id) {
//         // console.warn("Found device with empty player_id:", d._id);
//         return false;
//       }
//       // OneSignal player IDs are typically UUIDs
//       const isValidFormat = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id);
//       if (!isValidFormat) {
//         // console.warn("Found device with invalid player_id format:", id);
//       }
//       return isValidFormat;
//     });

//     // console.log("Valid player IDs:", player_ids);
//     return player_ids;
//   } catch (error) {
//     // console.error("Error finding devices:", error);
//     return [];
//   }
// }

// module.exports = {
//   notify: async (user, title, content, track) => {
//     try {
//       const player_ids = await findDevices(user);
//       // console.log("player_ids====>", player_ids);

//       if (player_ids.length === 0) {
//         // console.log("No active devices found for user:", user);
//         return { success: false, message: "No active devices found" };
//       }

//       const notObj = { for: user, message: content, title: title };
//       if (track) notObj.data = { track };

//       // console.log("Creating notification object:", notObj);
//       await Notification.create(notObj);

//       return sendNotification(content, player_ids, title, track);
//     } catch (error) {
//       // console.error("Error in notify function:", error);
//       throw error;
//     }
//   },

//   notifyAllUsers: async (content, title, job = null) => {
//     try {
//       const devices = await Device.find({ is_active: true }).populate("user");
//       // console.log("Total active devices found:", devices.length);

//       if (devices.length === 0) {
//         // console.log("No active devices found for broadcast");
//         return { success: false, message: "No active devices found" };
//       }

//       const player_ids = devices.map((d) => d.player_id);
//       const user_ids = [...new Set(devices.map((d) => d.user._id))]; // Get unique user IDs

//       // console.log("Broadcasting to player IDs:", player_ids);
//       // console.log("Broadcasting to users:", user_ids);

//       const notificationPromises = user_ids.map((userId) => {
//         const notObj = {
//           for: userId,
//           message: content,
//           title: title,
//           type: "general",
//         };
//         if (job) notObj.invited_for = job;
//         return Notification.create(notObj);
//       });

//       await Promise.all(notificationPromises);
//       // console.log("Notification records created for all users");

//       return sendNotification(content, player_ids, title);
//     } catch (error) {
//       // console.error("Error in notifyAllUsers function:", error);
//       throw error;
//     }
//   },

//   // Legacy method name for backward compatibility
//   notifyAllUser: async (users, content, job = null, title) => {
//     // console.log(
// //       "Using legacy notifyAllUser method, redirecting to notifyAllUsers"
// //     );
//     return module.exports.notifyAllUsers(content, title, job);
//   },

//   // Test OneSignal configuration
//   testOneSignalConfig: async () => {
//     try {
//       // console.log("=== OneSignal Configuration Test ===");

//       // Check environment variables
//       // console.log("1. Environment check:");
//       // console.log("   ONESIGNAL_APP_ID:", ONESIGNAL_APP_ID || "MISSING");
//       // console.log("   ONESIGNAL_REST_API_KEY exists:", !!process.env.ONESIGNAL_REST_API_KEY);

//       if (!ONESIGNAL_APP_ID || !process.env.ONESIGNAL_REST_API_KEY) {
//         return {
//           success: false,
//           message: "OneSignal credentials are missing",
//           details: {
//             appId: !!ONESIGNAL_APP_ID,
//             apiKey: !!process.env.ONESIGNAL_REST_API_KEY
//           }
//         };
//       }

//       // Test basic notification structure (without sending)
//       const testNotification = new OneSignal.Notification();
//       testNotification.app_id = ONESIGNAL_APP_ID;
//       testNotification.include_player_ids = ["test-player-id"];
//       testNotification.contents = { en: "Test message" };
//       testNotification.headings = { en: "Test title" };

//       // console.log("2. Test notification object created successfully");
//       // console.log("3. Configuration appears valid");

//       return {
//         success: true,
//         message: "OneSignal configuration test passed",
//         config: {
//           appId: ONESIGNAL_APP_ID,
//           hasApiKey: !!process.env.ONESIGNAL_REST_API_KEY,
//           clientInitialized: !!client
//         }
//       };

//     } catch (error) {
//       // console.error("OneSignal configuration test failed:", error);
//       return {
//         success: false,
//         message: "OneSignal configuration test failed",
//         error: error.message
//       };
//     }
//   },
// };




const OneSignal = require("@onesignal/node-onesignal");
const mongoose = require("mongoose");
const Device = require("../model/device");
const Notification = mongoose.model("Notification");
const User = mongoose.model("User");
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;

const ONESIGNAL_REST_API_KEY = {
  getToken() {
    return process.env.ONESIGNAL_REST_API_KEY;
  }
};
const configuration = OneSignal.createConfiguration({

  restApiKey: process.env.ONESIGNAL_REST_API_KEY,
  authMethods: {
    rest_api_key: { tokenProvider: ONESIGNAL_REST_API_KEY }
  }
});
const client = new OneSignal.DefaultApi(configuration);

async function sendNotification(content, player_ids, title, track) {
  try {
    const notification = new OneSignal.Notification();
    notification.app_id = ONESIGNAL_APP_ID;
    notification.include_subscription_ids = player_ids;
    notification.contents = {
      en: content,
    };
    if (title) {
      notification.headings = {
        en: title,
      };
    }
    // if (track) {
    //   notification.buttons = [
    //     {
    //       id: 'claim-btn',
    //       text: 'Track Order',
    //       icon: 'https://img.icons8.com/ios-filled/50/gift.png',
    //       url: track // Link opens when button is clicked
    //     }
    //   ]
    // }
    notification.name = "BachHoaHouston";
    return await client.createNotification(notification);
  } catch (err) {
    // console.log("error in send notification", content);
    // console.error("error in send notification", err);
  }
}
async function findDevices(user) {
  const devices = await Device.find({ user });
  // // console.log(devices)
  return devices.map((d) => d.player_id);
}

module.exports = {
  notify: async (user, title, content, track) => {
    // console.log(user, title, content, track)
    const player_ids = await findDevices(user);
    // console.log('player_ids====>', user)
    const notObj = { for: user, message: content, title: title, track };
    // console.log('notobj', notObj)
    await Notification.create(notObj);
    return sendNotification(content, player_ids, title, track);
  },
  notifyAllUser: async (users, content, job = null, title) => {

    // if (!title) {
    //   const offer = await OFFER.findById(job);
    //   title = offer.offername;
    // }
    const devices = await User.find();
    // // console.log("devices===========>", devices);
    const player_ids = devices.map((d) => d._id);

    const notObj = { for: player_ids, message: content, title: title };
    if (job) notObj.invited_for = job;
    await Notification.create(notObj);

    return;
    // sendNotification(content, player_ids, title);
  },
};

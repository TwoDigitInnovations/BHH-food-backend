"use strict";
const mongoose = require("mongoose");
const Notification = mongoose.model("Notification");
const response = require("./../responses");
const { decryptPopulatedData } = require("../../middlewares/codeDecript");

module.exports = {
  getNotification: async (req, res) => {
    try {
      const userId = req.user.id;
      const notifications = await Notification.find({ for: userId })
        .sort({ sent_at: -1 })
        .populate("for", "user_email _id")
        .lean();
      const data = decryptPopulatedData(notifications, 'for');
      // console.log("Fetched notifications for user:", userId);

      return res.status(200).json({
        status: true,
        data,
      });
    } catch (error) {
      // console.error("Error fetching notifications:", error);
      return response.error(res, error);
    }
  }
};

"use strict";

const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema(
  {
    for: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      default: null,
    },
    invited_for: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sale", // If sale of anything
      default: null,
    },
    type: {
      type: String,
      enum: ["general", "order", "promo", "system"],
      default: "general",
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    read: {
      type: Boolean,
      default: false,
    },
    sent_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
NotificationSchema.index({ for: 1, read: 1, createdAt: -1 });
NotificationSchema.index({ sent_at: -1 });

module.exports = mongoose.model("Notification", NotificationSchema);

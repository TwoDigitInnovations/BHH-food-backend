"use strict";

const mongoose = require("mongoose");

const DeviceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    player_id: {
      type: String,
      required: true,
      unique: true,
    },
    device_type: {
      type: String,
      enum: ["ios", "android", "web"],
      required: true,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    last_active: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
DeviceSchema.index({ user: 1, is_active: 1 });
DeviceSchema.index({ player_id: 1 });

module.exports = mongoose.model("Device", DeviceSchema);

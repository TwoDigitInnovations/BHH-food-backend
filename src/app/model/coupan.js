"use strict";
const { Type } = require("@aws-sdk/client-s3");
const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,

      unique: true,
    },
    discountValue: {
      type: Number,
    },
    userId: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    discountType: {
      type: String,
      enum: ["percentage", "fixed"],
    },
    minimumAmount: {
      type: Number,
    },
    ussageType: {
      type: String,
      enum: ["once", "multiple"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    firstOrder: {
      type: Boolean,
    },
    expiryDate: {
      type: Date,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

couponSchema.set("toJSON", {
  getters: true,
  virtuals: false,
  transform: (doc, ret, options) => {
    delete ret.__v;
    return ret;
  },
});
module.exports = mongoose.model("Coupon", couponSchema);

"use strict";

const mongoose = require("mongoose");

const pointSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["Point"],
  },
  coordinates: {
    type: [Number],
  },
});

const productrequestchema = new mongoose.Schema(
  {
    productDetail: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },
        image: [
          {
            type: String,
          },
        ],
        total: {
          type: Number,
        },
        qty: {
          type: Number,
        },
        price: {
          type: Number,
        },
        BarCode: {
          type: String,
        },
        seller_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    status: {
      type: String,
      enum: [
        "Pending",
        "Completed",
        "Return",
        "Cancel",
        "Shipped",
        "Return Requested",
        "Driverassigned",
        "Delivered",
        "Preparing",
      ],
      default: "Pending",
    },
    orderId: {
      type: String,
      unique: true,
    },
    orderTime: { type: String }, // or Date if you want Date object
    orderDate: {
      type: String,
    },
    stripeSessionId: {
      type: String,
    },
    Deliverytip: {
      type: String,
    },
    serviceFee: {
      type: Number,
    },
    totalTax: {
      type: String,
    },
    subtotal: {
      type: String,
    },
    deliveryfee: {
      type: String,
    },
    paymentStatus: {
      type: String,
      enum: ["Pending", "Succeeded", "Failed"],
      default: "Pending",
    },

    seller_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    discount: {
      type: String,
    },
    driver_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    Local_address: {
      type: Object,
    },
    total: {
      type: String,
    },
    note: {
      type: String,
    },
    location: {
      type: pointSchema,
    },
    dateOfDelivery: {
      type: Date,
    },
    isReady: {
      type: Boolean,
      default: false,
    },
    isOrderPickup: {
      type: Boolean,
    },
    isDriveUp: {
      type: Boolean,
    },
    isLocalDelivery: {
      type: Boolean,
    },
    isShipmentDelivery: {
      type: Boolean,
    },
    parkingNo: {
      type: String,
    },
    SecretCode: {
      type: String,
    },
    carBrand: {
      type: String,
    },
    carColor: {
      type: String,
    },
    trackingLink: {
      type: String,
    },
    trackingNo: {
      type: String,
    },
    proofOfDelivery: {
      type: [String],
    },
    deliveredAt: {
      type: Date,
    },
    order_platform: {
      type: String,
    },
    isDeleted:{
        type: Boolean,
        default: false
    }
  },
  {
    timestamps: true,
  }
);

productrequestchema.set("toJSON", {
  getters: true,
  virtuals: false,
  transform: (doc, ret, options) => {
    delete ret.__v;
    return ret;
  },
});
productrequestchema.index({ location: "2dsphere" });

module.exports = mongoose.model("ProductRequest", productrequestchema);

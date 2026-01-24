"use strict";

const mongoose = require("mongoose");
const productchema = new mongoose.Schema(
  {
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },
    userid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    categoryName: {
      type: String,
    },
    gender: {
      type: String,
    },
    manufacturername: {
      type: String,
    },
    manufactureradd: {
      type: String,
    },
    expirydate: {
      type: Date,
    },
    isShipmentAvailable: {
      type: Boolean,
    },
    name: {
      type: String,
    },
    vietnamiesName: {
      type: String,
    },
    relatedName: {
      type: [],
    },
    slug: {
      type: String,
    },
    image: {
      type: String,
    },
    imageAltName: {
      type: String,
    },
    metatitle: {
      type: String,
    },
    metadescription: {
      type: String,
    },
    BarCode: {
      type: Number,
    },
    Deliverytip: {
      type: Number,
    },
    short_description: {
      type: String,
    },
    long_description: {
      type: String,
    },

    isReturnAvailable: {
      type: Boolean,
    },
    pieces: {
      type: Number,
    },
    sold_pieces: {
      type: Number,
      default: 0,
    },
    tax: {
      type: Number,
    },
    varients: {
      type: [],
    },
    isShipmentDelivery: {
      type: Boolean,
    },
    isOrderPickup: {
      type: Boolean,
    },
    isLocalDelivery: {
      type: Boolean,
    },
    isDriveUp: {
      type: Boolean,
    },
    minQuantity: {
      type: Number,
    },
    parameter_type: {
      type: String,
    },
    price_slot: [],

    status: {
      type: String,
      enum: ["verified", "suspended"],
      default: "verified",
    },

    Allergens: {
      type: String,
    },
    Quantity: {
      type: Number,
    },
    // New inventory fields
    warehouse: {
      type: String,
    },
    bin: {
      type: String,
    },
    batchNumber: {
      type: String,
    },
    itemUOM: {
      type: String,
    },
    ReturnPolicy: {
      type: String,
    },
    disclaimer: {
      type: String,
    },
    Warning: {
      type: String,
    },
    isNextDayDeliveryAvailable: {
      type: Boolean,
    },
    isInStoreAvailable: {
      type: Boolean,
    },
    isCurbSidePickupAvailable: {
      type: Boolean,
    },
    tax_code: {
      type: String,
    },
    paymentStatus: {
      type: String,
    },
    customerDetails: {
      type: String,
    },
    from: {
      type: String,
    },
    position: {
      type: Number,
      default: null,
    },
    isDeleted:{
        type: Boolean,
        default: false
    }

    // attributes: [
    //     {
    //         name: { type: String },
    //         value: { type: String, default: '' }
    //     }
    // ]
  },
  {
    timestamps: true,
  }
);

productchema.set("toJSON", {
  getters: true,
  virtuals: false,
  transform: (doc, ret, options) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model("Product", productchema);

"use strict";

const mongoose = require("mongoose");

const ShippingCostSchema = new mongoose.Schema(
  {
    ShippingCostforLocal: {
      type: Number,
      default: 0,
    },
    minShippingCostforLocal: {
      type: Number,
      default: 0,
    },
    ShipmentCostForShipment: {
      type: Number,
      default: 0,
    },
    minShipmentCostForShipment: {
      type: Number,
      default: 0,
    },
    serviesCost: {
      type: Number,
      default: 0,
    },
    minServiesCost: {
      type: Number,
      default: 0,
    },
    shipmentCostMessage: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

ShippingCostSchema.set("toJSON", {
  getters: true,
  virtuals: false,
  transform: (doc, ret, options) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model("Shippingcost", ShippingCostSchema);

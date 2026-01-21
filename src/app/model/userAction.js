"use strict";
const mongoose = require('mongoose');


const UserActionLogSchema = new mongoose.Schema(
    {
        // User reference (nullable for guest users)
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            index: true,
            required: false
        },

        // Action metadata
        action: {
            type: String,
            required: true,
            index: true
            // examples: LOGIN, LOGOUT, CREATE_ORDER, UPDATE_PROFILE
        },

        method: {
            type: String,
            enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
            required: true
        },

        endpoint: {
            type: String,
            required: true
        },

        // Request IP info
        ipConfig: {
            type: Object,
            index: true
        },

        // Device / client info
        userAgent: {
            type: String
        },

        // Optional metadata (safe payload)
        meta: {
            type: Object
            // example: { orderId, status, errorCode }
        },

        // Success / failure tracking
        status: {
            type: String,
            enum: ['SUCCESS', 'FAILURE'],
            default: 'SUCCESS'
        },
        createdAt: { type: Date, expires: '90d' }
    },
    {
        timestamps: true // createdAt, updatedAt
    }
);

// Index for fast filtering
UserActionLogSchema.index({ createdAt: -1 });
UserActionLogSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model("UserActionLog", UserActionLogSchema);

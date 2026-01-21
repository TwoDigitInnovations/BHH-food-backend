'use strict';

const mongoose = require('mongoose');
const storeschema = new mongoose.Schema({

    userid: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    },
    firstName: {
        type: String,
    },
    lastName: {
        type: String,
    },
    companyName: {
        type: String,
    },
    address: {
        type: String,
    },
    city: {
        type: String,
    },
    kbis: {
        type: String,
    },
    country: {
        type: Object,
    },
    identity: {
        type: String,
    },
    phone: {
        type: Number,
    },
    email: {
        type: String,
    },
    verification: {
        type: String,
        default: "Pending"
    },

}, {
    timestamps: true
});

storeschema.set('toJSON', {
    getters: true,
    virtuals: false,
    transform: (doc, ret, options) => {
        delete ret.__v;
        return ret;
    }
});

module.exports = mongoose.model('Store', storeschema);
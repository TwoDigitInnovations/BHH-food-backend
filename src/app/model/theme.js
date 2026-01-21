'use strict';

const mongoose = require('mongoose');
const themeSchema = new mongoose.Schema({
    name: {
        type: String,
    },
    image: {
        type: String
    },
    parameter_type: {
        type: String
    },
    description: {
        type: String
    }
}, {
    timestamps: true
});

themeSchema.set('toJSON', {
    getters: true,
    virtuals: false,
    transform: (doc, ret, options) => {
        delete ret.__v;
        return ret;
    }
});

module.exports = mongoose.model('Theme', themeSchema);
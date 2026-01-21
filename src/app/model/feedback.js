// models/Feedback.js
const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
    fullName: {
        type: String,

    },
    email: {
        type: String,

    },
    phoneNumber: {
        type: Number,

    },
    query: {
        type: String,

    },
    status: {
        type: String,
        enum: ['pending', 'resolved', 'closed'],
        default: 'pending',
    },


}, { timestamps: true });


feedbackSchema.set("toJSON", {
    getters: true,
    virtuals: false,
    transform: (doc, ret, options) => {
        delete ret.__v;
        return ret;
    },
});

module.exports = mongoose.model('ContactUs', feedbackSchema);

"use strict";
const mongoose = require("mongoose");
const ContactUs = mongoose.model("ContactUs");
const response = require("./../responses");

module.exports = {
  getAllFeedback: async (req, res) => {
    try {
      let cond = {};

      if (req.body.curDate) {
        const startDate = new Date(req.body.curDate);
        const endDate = new Date(new Date(req.body.curDate).setDate(startDate.getDate() + 1));
        cond.createdAt = { $gte: startDate, $lte: endDate };
      }

      if (req.body.fullName) {
        const name = req.body.fullName.substring(0, 3); // take first 3 characters
        cond.fullName = { $regex: '^' + name, $options: 'i' };
      }

      if (req.body.phoneNumber) {
        const prefix = Number(String(req.body.phoneNumber).substring(0, 4));
        const start = prefix * 10 ** 6;
        const end = (prefix + 1) * 10 ** 6;
        cond.phoneNumber = { $gte: start, $lt: end };
      }

      let page = parseInt(req.query.page) || 1;
      let limit = parseInt(req.query.limit) || 10;
      let skip = (page - 1) * limit;

      const totalItems = await ContactUs.countDocuments(cond);
      const totalPages = Math.ceil(totalItems / limit);

      const feedback = await ContactUs.find(cond)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      return res.status(200).json({
        status: true,
        data: feedback,
        pagination: {
          totalItems,
          totalPages,
          currentPage: page,
          itemsPerPage: limit,
        },
      });
    } catch (error) {
      return response.error(res, error);
    }
  },



  // Create new feedback
  createFeedback: async (req, res) => {
    try {
      const feedback = await ContactUs.create(req.body);
      return response.ok(res, feedback);
    } catch (error) {
      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(val => val.message);
        return res.status(400).json({
          success: false,
          error: messages
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Server Error'
        });
      }
    }
  },

  updateStatus: async (req, res) => {
    try {
      const { id, status } = req.body;

      if (!id || !status) {
        return res.status(400).json({ status: false, message: 'ID and status are required.' });
      }

      const validStatuses = ['pending', 'resolved', 'closed'];

      if (!validStatuses.includes(status)) {
        return res.status(400).json({ status: false, message: 'Invalid status value.' });
      }

      // updateData define karo
      const updateData = { status };

      const updatedContact = await ContactUs.findByIdAndUpdate(
        id,
        updateData,
        { new: true }
      );

      if (!updatedContact) {
        return res.status(404).json({ status: false, message: 'Contact not found.' });
      }

      return res.status(200).json({ status: true, message: 'Status updated successfully', data: updatedContact });

    } catch (error) {
      // console.error("Update Status Error:", error);
      return res.status(500).json({ status: false, message: 'Server error', error: error.message });
    }
  }

}

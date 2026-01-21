"use strict";
const mongoose = require("mongoose");
const Pincode = mongoose.model("Pincode");


const getAllPincodes = async (req, res) => {
  try {
    const pincodes = await Pincode.find({}, { __v: 0 }) // Remove extra fields
      .sort({ pincode: 1 }); // Optional: sort by pincode
    res.status(200).json({ pincodes }); // Send as an object for clarity
  } catch (err) {
    res.status(500).json({ error: 'Error fetching pincodes' });
  }
};


const addPincode = async (req, res) => {
  try {
    const { pincodes } = req.body;

    if (!Array.isArray(pincodes) || pincodes.length === 0) {
      return res.status(400).json({ error: 'Invalid or missing pincodes array' });
    }

    const results = [];

    for (const pin of pincodes) {
      const trimmedPin = pin.trim();
      if (!trimmedPin) continue;

      const existing = await Pincode.findOne({ pincode: trimmedPin });
      if (!existing) {
        const newPincode = new Pincode({ pincode: trimmedPin });
        await newPincode.save();
        results.push(newPincode);
      }
    }

    if (results.length === 0) {
      return res.status(409).json({ error: 'All pincodes already exist' });
    }

    res.status(201).json({ message: 'Pincodes added successfully', added: results });
  } catch (err) {
    res.status(500).json({ error: 'Error adding pincodes' });
  }
};


// Delete a pincode
const deletePincode = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Invalid pincode' });
    }

    const deleted = await Pincode.findByIdAndDelete(id) // ✅ Match with parameter

    if (!deleted) {
      return res.status(404).json({ error: 'Pincode not found' });
    }

    res.json({ message: `Pincode ${id} deleted successfully` }); // ✅ Fixed template string
  } catch (err) {
    // console.error(err); // optional: for debugging
    res.status(500).json({ error: 'Error deleting pincode' });
  }
};



const checkPincodeAvailability = async (req, res) => {
  try {
    const { pincode } = req.body;

    if (!pincode || typeof pincode !== "string") {
      return res.status(400).json({ error: "Invalid pincode" });
    }

    const pin = await Pincode.findOne({ pincode: pincode.trim() });

    if (!pin) {
      return res.json({ available: false });
    }

    return res.json({ available: true });
  } catch (err) {
    // console.error(err);
    return res.status(500).json({ error: "Error checking pincode availability" });
  }
};

module.exports = {
  getAllPincodes,
  addPincode,
  deletePincode,
  checkPincodeAvailability,
};

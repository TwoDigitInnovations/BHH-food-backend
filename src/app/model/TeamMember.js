const mongoose = require("mongoose");

const teamMemberSchema = new mongoose.Schema({
  memberimage: {
    type: String,
    required: true,
    trim: true
  },
  membername: {
    type: String,
    required: true,
    trim: true
  },
  memberposition: {
    type: String,
    required: true,
    trim: true
  }
}, { timestamps: true });

module.exports = mongoose.model("TeamMember", teamMemberSchema);

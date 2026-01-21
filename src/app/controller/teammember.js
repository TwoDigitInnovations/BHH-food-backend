const mongoose = require("mongoose");
const TeamMember = require("../model/TeamMember"); // Adjust path as needed
const response = require("./../responses");

module.exports = {
  // Create a new team member
  createTeamMember: async (req, res) => {
    try {
      const { memberimage, membername, memberposition } = req.body;

      if (!memberimage || !membername || !memberposition) {
        return res.status(400).json({
          success: false,
          message: "Member image ,position and name  are required",
        });
      }

      const member = new TeamMember({
        memberimage,
        membername,
        memberposition,
      });

      const savedMember = await member.save();

      return res.status(201).json({
        success: true,
        message: "Team member created successfully!",
        data: savedMember,
      });
    } catch (e) {
      return res.status(500).json({
        success: false,
        message: e.message,
      });
    }
  },

  // Get all team members
  getTeamMembers: async (req, res) => {
    try {
      const members = await TeamMember.find({});

      return res.status(200).json({
        success: true,
        message: "Fetched all team members successfully!",
        team: members,
      });
    } catch (e) {
      return res.status(500).json({
        success: false,
        message: e.message,
      });
    }
  },

  // Get a single team member by ID
  getTeamMemberById: async (req, res) => {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid member ID",
        });
      }

      const member = await TeamMember.findById(id);

      if (!member) {
        return res.status(404).json({
          success: false,
          message: "Team member not found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Team member fetched successfully!",
        data: member,
      });
    } catch (e) {
      return res.status(500).json({
        success: false,
        message: e.message,
      });
    }
  },

  // Update a team member
  updateTeamMember: async (req, res) => {
    try {
      const { id, memberimage, membername, memberposition } = req.body;

      // Validation
      if (!id) {
        return res.status(400).json({
          success: false,
          message: "Member ID is required",
        });
      }

      if (!memberimage || !membername || !memberposition) {
        return res.status(400).json({
          success: false,
          message: "Member image and name are required",
        });
      }

      const updateData = {
        memberimage,
        membername,
        memberposition,
      };

      const updatedMember = await TeamMember.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
      });

      if (!updatedMember) {
        return res.status(404).json({
          success: false,
          message: "Team member not found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Team member updated successfully!",
        team: updatedMember,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },

  // Delete a team member
  deleteTeamMember: async (req, res) => {
    try {
      const { id } = req.params;
      const deletedMember = await TeamMember.findByIdAndDelete(req.params.id);
      return res.status(200).json({
        success: true,
        message: "Team member deleted successfully!",
        data: deletedMember,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },

  bulkDeleteTeamMembers: async (req, res) => {
    try {
      const { ids } = req.body;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Array of member IDs is required",
        });
      }

      const invalidIds = ids.filter(
        (id) => !mongoose.Types.ObjectId.isValid(id)
      );
      if (invalidIds.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid member IDs found",
        });
      }

      const result = await TeamMember.deleteMany({
        _id: { $in: ids },
      });

      return res.status(200).json({
        success: true,
        message: `${result.deletedCount} team members deleted successfully!`,
        deletedCount: result.deletedCount,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },
};

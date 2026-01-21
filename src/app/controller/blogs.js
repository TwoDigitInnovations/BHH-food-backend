const mongoose = require("mongoose");
const Blog = mongoose.model("Blog");
const response = require("./../responses");
const mailNotification = require("../services/mailNotification");

module.exports = {
  getBloggCategory: async (req, res) => {
    return response.ok(res, [
      {
        id: 0,
        label: "All Blogs",
      },
      {
        id: 1,
        label: "Cleaning Checklists",
      },
      {
        id: 2,
        label: "Cleaning Tips",
      },
      {
        id: 3,
        label: "Decluttering",
      },
      {
        id: 4,
        label: "Eco living",
      },
    ]);
  },

  createBlog: async (req, res) => {
    try {
      const payload = req?.body || {};
      payload.posted_by = req.user.id;
      let blog = new Blog(payload);
      const blg = await blog.save();
      return response.ok(res, blg);
    } catch (error) {
      return response.error(res, error);
    }
  },

  getBlog: async (req, res) => {
    try {
      let blog = await Blog.find().populate("posted_by", "username  email");
      return response.ok(res, blog);
    } catch (error) {
      return response.error(res, error);
    }
  },

  getBlogById: async (req, res) => {
    try {

      const { id } = req.body;
      let blog = await Blog.findById(id)
      if (!blog) {
        return res.status(404).json({ message: "Blog not found" });
      }

      return response.ok(res, blog);
    } catch (error) {
      console.error(error); // Log the error for debugging
      return response.error(res, error);
    }
  },
  getBlogByCategory: async (req, res) => {
    try {
      let cond = {
        website: req?.body?.website || 'ADN'
      };
      if (req?.body?.cat_id !== 0) {
        cond.category = req?.body?.cat_id
      }
      let blog = await Blog.find(cond).populate(
        "posted_by",
        "username  email"
      );

      return response.ok(res, blog);
    } catch (error) {
      return response.error(res, error);
    }
  },

  updateBlog: async (req, res) => {
    try {
      const payload = req?.body || {};
      let blog = await Blog.findByIdAndUpdate(payload?.id, payload, {
        new: true,
        upsert: true,
      });
      return response.ok(res, blog);
    } catch (error) {
      return response.error(res, error);
    }
  },

  deleteBlog: async (req, res) => {
    try {
      let blog = await Blog.findByIdAndDelete(req?.body?._id);
      return response.ok(res, { meaasge: "Deleted successfully" });
    } catch (error) {
      return response.error(res, error);
    }
  },

  checkEmailNotiFication: async (req, res) => {
    try {
      await mailNotification.bookMail({ user: { email: req.params.email } });
      return response.ok(res, { meaasge: "Sent successfully" });
    } catch (error) {
      return response.error(res, error);
    }
  },
};

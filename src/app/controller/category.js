const mongoose = require("mongoose");
const Category = mongoose.model("Category");
const response = require("./../responses");
const mailNotification = require("../services/mailNotification");
const generateUniqueId = require("generate-unique-id");

module.exports = {
  createCategory: async (req, res) => {
    try {
      const payload = req?.body || {};
      payload.slug = payload.name
        .toLowerCase()
        .replace(/ /g, "-")
        .replace(/[^\w-]+/g, "");
      let cat = new Category(payload);
      const category = await cat.save();
      return response.ok(res, category, {
        message: "Category added successfully",
      });
    } catch (error) {
      return response.error(res, error);
    }
  },

  getCategory: async (req, res) => {
    try {
      const category = await Category.find({
        $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }],
      });

      return response.ok(res, category);
    } catch (error) {
      // console.error(error);
      return response.error(res, error);
    }
  },

  getPopularCategory: async (req, res) => {
    try {
      let category = await Category.aggregate([
        {
          $match: { popular: true },
        },
        {
          $lookup: {
            from: "products",
            localField: "_id",
            foreignField: "category",
            as: "products",
            pipeline: [
              {
                $limit: 2,
              },
              {
                $project: {
                  varients: { $arrayElemAt: ["$varients.image", 0] },
                },
              },
              {
                $project: {
                  image: { $arrayElemAt: ["$varients", 0] },
                },
              },
            ],
          },
        },
        {
          $project: {
            name: 1,
            image: 1,
            products: 1,
          },
        },
        {
          $limit: 3,
        },
      ]);
      return response.ok(res, category);
    } catch (error) {
      return response.error(res, error);
    }
  },

  getCategoryById: async (req, res) => {
    try {
      let category = await Category.findById(req?.params?.id);
      return response.ok(res, category);
    } catch (error) {
      return response.error(res, error);
    }
  },

  updateCategory: async (req, res) => {
    try {
      const payload = req?.body || {};
      if (payload.name) {
        payload.slug = payload.name
          .toLowerCase()
          .replace(/ /g, "-")
          .replace(/[^\w-]+/g, "");
      }
      let category = await Category.findByIdAndUpdate(payload?.id, payload, {
        new: true,
        upsert: true,
      });
      return response.ok(res, category);
    } catch (error) {
      return response.error(res, error);
    }
  },

  deleteCategory: async (req, res) => {
    try {
      const category = await Category.findByIdAndUpdate(
        req.params.id,
        { isDeleted: true },
        { new: true }
      );

      if (!category) {
        return response.error(res, {
          message: "Category not found",
        });
      }

      return response.ok(res, {
        message: "Category deleted successfully",
      });
    } catch (error) {
      // console.error(error);
      return response.error(res, error);
    }
  },

  deleteAllCategory: async (req, res) => {
    try {
      const newid = req.body.category.map(
        (f) => new mongoose.Types.ObjectId(f)
      );
      await Category.deleteMany({ _id: { $in: newid } });
      return response.ok(res, { meaasge: "Deleted successfully" });
    } catch (error) {
      return response.error(res, error);
    }
  },
};

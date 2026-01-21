"use strict";
const mongoose = require("mongoose");
const blog = new mongoose.Schema(
  {
    blog_title: {
      type: String,
    },
    blog_image: {
      type: String,
    },
    blog_content: {
      type: String,
    },
    posted_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    blog: {
      type: [
        {
          title: {
            type: String,
          },
          image: {
            type: String,
          },
          content: {
            type: String,
          },
          services: {
            type: [
              {
                type: String,
              },
            ],
          },
        },
      ],
    },
    metatitle: {
      type: String,
    },
    metadescription: {
      type: String,
    },
    category: {
      type: String,
    },
    website: {
      type: String,
      enum: ["ADN", "OVEN", "COMMERCIAL", "REMOVAL"],
    },


  },
  {
    timestamps: true,
  }
);

blog.set("toJSON", {
  getters: true,
  virtuals: false,
  transform: (doc, ret, options) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model("Blog", blog);

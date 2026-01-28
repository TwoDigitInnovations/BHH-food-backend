const mongoose = require("mongoose");
const Product = mongoose.model("Product");
const ProductRequest = mongoose.model("ProductRequest");
const User = mongoose.model("User");
const response = require("./../responses");
const mailNotification = require("../services/mailNotification");
const { getReview } = require("../helper/user");
// const { User } = require("@onesignal/node-onesignal");
const Favourite = mongoose.model("Favourite");
const Category = mongoose.model("Category");
const Review = mongoose.model("Review");
const FlashSale = mongoose.model("FlashSale");
const { DateTime } = require("luxon");
const ContactUs = mongoose.model("ContactUs");
const { notify } = require("../services/notification");
const { updateImageExtension } = require("../services/fileUpload");
const Coupon = mongoose.model("Coupon");
const ShippingCost = mongoose.model("Shippingcost");
const ExcelJS = require("exceljs");
const { zip } = require("underscore");
const {
  decryptPopulatedData,
  decryptValue,
  decryptObject,
} = require("../../middlewares/codeDecript");

// Helper function to filter product data based on user authentication
const filterProductData = async (products, req) => {
  console.log("=== filterProductData Debug ===");
  let user = null;
  
  // Check if Authorization header exists and extract user info manually
  const authHeader = req.headers.authorization;
  console.log("Auth header:", authHeader);
  
  if (authHeader && authHeader.startsWith('jwt ')) {
    try {
      const token = authHeader.substring(4); // Remove 'jwt ' prefix
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.SECRET);
      console.log("Decoded JWT:", decoded);
      
      if (decoded && decoded.id) {
        user = await User.findById(decoded.id).lean();
        console.log("Found user:", {
          id: user?._id,
          documentVerified: user?.documentVerified,
          type: user?.type
        });
      } else if (decoded && decoded.user && decoded.user.id) {
        // Handle different JWT structure
        user = await User.findById(decoded.user.id).lean();
        console.log("Found user (alt structure):", {
          id: user?._id,
          documentVerified: user?.documentVerified,
          type: user?.type
        });
      }
    } catch (error) {
      console.log("JWT verification error:", error.message);
      // Token invalid or expired, treat as unauthenticated
      user = null;
    }
  } else {
    console.log("No valid auth header found");
  }

  // If user is not logged in or document not verified, remove price_slot
  // Exception: Admin and Employee users should always see prices
  const shouldShowPrices = user && (user.documentVerified === true || user.type === "ADMIN" || user.type === "EMPLOYEE");
  console.log("Should show prices:", shouldShowPrices);

  return products.map(product => {
    if (!shouldShowPrices) {
      console.log("Removing price_slot from product:", product.name);
      // Remove price_slot if user is not authenticated or document not verified
      const { price_slot, ...productWithoutPrices } = product;
      return productWithoutPrices;
    }
    console.log("Keeping price_slot for product:", product.name);
    return product;
  });
};

module.exports = {
  createProduct: async (req, res) => {
    try {
      const payload = req?.body || {};
      if (!payload.slug || payload.slug.trim() === "") {
        payload.slug = payload.name
          .toLowerCase()
          .replace(/ /g, "-")
          .replace(/[^\w-]+/g, "");
      }
      let product = new Product(payload);
      await product.save();

      return response.ok(res, { message: "Product added successfully" });
    } catch (error) {
      return response.error(res, error);
    }
  },

  updateProductManually: async (req, res) => {
    try {
      let totalProducts = await Product.find({ status: { $exists: false } });
      // await Promise.all(
      //   totalProducts.map(async (m) => {
      //     // if (!m.varients) {
      //     await Product.findByIdAndUpdate(m._id, {
      //       status: "verified"
      //     })
      //     // }
      //   }))
      return response.ok(res, totalProducts);
    } catch (error) {
      return response.error(res, error);
    }
  },

  getProductBySale: async (req, res) => {
    try {
      const flashSales = await FlashSale.find();

      if (!flashSales || flashSales.length === 0) {
        return response.ok(res, []);
      }

      const productIds = flashSales.flatMap((flashSale) => flashSale.products);
      if (!productIds || productIds.length === 0) {
        return response.ok(res, []);
      }

      const productDetails = await Product.find({ _id: { $in: productIds } }).lean();

      // Filter product data based on user authentication and document verification
      const filteredProducts = await filterProductData(productDetails, req);

      return response.ok(res, filteredProducts);
    } catch (error) {
      // // // console.error("Error fetching products by sale:", error);
      return response.error(res, error);
    }
  },

  getProduct: async (req, res) => {
    try {
      let page = parseInt(req.query.page) || 1;
      let limit = parseInt(req.query.limit) || 10;
      let skip = (page - 1) * limit;

      let cond = {
        $and: [
          {
            $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }],
          },
        ],
      };

      if (req.query.search && req.query.search.trim() !== "") {
        cond.$and.push({
          $or: [
            { name: { $regex: req.query.search, $options: "i" } },
            { vietnamiesName: { $regex: req.query.search, $options: "i" } },
          ],
        });
      }

      if (req.query.seller_id) {
        cond.$and.push({ userid: req.query.seller_id });
      }

      let product = await Product.find(cond)
        .populate("category")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      // Filter product data based on user authentication and document verification
      const filteredProducts = await filterProductData(product, req);

      let totalProducts = await Product.countDocuments(cond);
      const totalPages = Math.ceil(totalProducts / limit);

      return res.status(200).json({
        status: true,
        data: filteredProducts,
        pagination: {
          totalItems: totalProducts,
          totalPages,
          currentPage: page,
          itemsPerPage: limit,
        },
      });
    } catch (error) {
      return response.error(res, error);
    }
  },

  getNewArrival: async (req, res) => {
    try {
      let data = {};

      if (req.query.seller_id) {
        data.userid = req.query.seller_id;
      }
      data.status = "verified";
      let page = parseInt(req.query.page) || 1;
      let limit = parseInt(req.query.limit);
      let skip = (page - 1) * limit;

      let product = await Product.find(data)
        .populate("category")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      // Filter product data based on user authentication and document verification
      const filteredProducts = await filterProductData(product, req);

      let totalProducts = await Product.countDocuments(data);
      const totalPages = Math.ceil(totalProducts / limit);

      return res.status(200).json({
        status: true,
        data: filteredProducts,
        pagination: {
          totalItems: totalProducts,
          totalPages: totalPages,
          currentPage: page,
          itemsPerPage: limit,
        },
      });
    } catch (error) {
      return response.error(res, error);
    }
  },

  getBulkProduct: async (req, res) => {
    try {
      let data = {};
      data.$expr = { $gt: [{ $size: "$price_slot" }, 1] };
      data.status = "verified";
      let page = parseInt(req.query.page) || 1;
      let limit = parseInt(req.query.limit);
      let skip = (page - 1) * limit;

      let product = await Product.find(data)
        .populate("category")
        .sort({ sold_pieces: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      // Filter product data based on user authentication and document verification
      const filteredProducts = await filterProductData(product, req);

      let totalProducts = await Product.countDocuments(data);
      const totalPages = Math.ceil(totalProducts / limit);

      return res.status(200).json({
        status: true,
        data: filteredProducts,
        pagination: {
          totalItems: totalProducts,
          totalPages: totalPages,
          currentPage: page,
          itemsPerPage: limit,
        },
      });
    } catch (error) {
      return response.error(res, error);
    }
  },

  getSponseredProduct: async (req, res) => {
    try {
      let data = { sponsered: true };
      if (req.query.seller_id) {
        data.userid = req.query.seller_id;
      }
      let product = await Product.find(data)
        .populate("category")
        .sort({ createdAt: -1 });
      return response.ok(res, product);
    } catch (error) {
      return response.error(res, error);
    }
  },

  getProductByslug: async (req, res) => {
    try {
      console.log("=== getProductByslug Debug ===");
      console.log("Request params:", req.params);
      console.log("Request query:", req.query);
      console.log("Authorization header:", req.headers.authorization);

      let product = await Product.findOne({
        slug: req?.params?.id,
        status: "verified",
      }).populate("category", "name slug").lean();

      if (!product) {
        return response.error(res, "Product not found or not verified");
      }

      console.log("Raw product price_slot:", product.price_slot);

      let reviews = await Review.find({ product: product._id })
        .populate("posted_by", "user_first_name")
        .lean();
      let data = [];
      if (reviews.length > 0) {
        data = decryptPopulatedData(reviews, "posted_by");
      }
      let favourite;
      if (req.query.user) {
        favourite = await Favourite.findOne({
          product: product._id,
          user: req.query.user,
        });
      }

      let d = {
        ...product,
        rating: await getReview(product._id),
        reviews: data,
        favourite: favourite ? true : false,
      };

      console.log("Product before filtering:", {
        name: d.name,
        price_slot: d.price_slot,
        hasAuth: !!req.headers.authorization
      });

      // Filter product data based on user authentication and document verification
      const [filteredProduct] = await filterProductData([d], req);

      console.log("Product after filtering:", {
        name: filteredProduct.name,
        price_slot: filteredProduct.price_slot,
        hasPriceSlot: !!filteredProduct.price_slot
      });

      return response.ok(res, filteredProduct);
    } catch (error) {
      console.error("getProductByslug error:", error);
      return response.error(res, error);
    }
  },

  getProductById: async (req, res) => {
    try {
      let product = await Product.findById(req?.params?.id).populate(
        "category",
        "name"
      ).lean();

      if (!product) {
        return response.notFound(res, { message: "Product not found" });
      }

      // Filter product data based on user authentication and document verification
      const [filteredProduct] = await filterProductData([product], req);

      return response.ok(res, filteredProduct);
    } catch (error) {
      return response.error(res, error);
    }
  },

  compareProduct: async (req, res) => {
    try {
      let product = await Product.find({ _id: { $in: req.body.ids } }).populate(
        "category"
      );
      return response.ok(res, product);
    } catch (error) {
      return response.error(res, error);
    }
  },
  getProductbycategory: async (req, res) => {
    try {
      const { limit, page } = req.query;
      const skip = (page - 1) * parseInt(limit);

      let cond = {
        status: "verified",
        $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }],
      };

      if (req.params.id !== "All" && req.params.id !== "all") {
        cond.category = req.params.id;
      }

      const products = await Product.find(cond)
        .populate("category")
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 })
        .lean();

      // Filter product data based on user authentication and document verification
      const filteredProducts = await filterProductData(products, req);

      return response.ok(res, filteredProducts);
    } catch (error) {
      return response.error(res, error);
    }
  },

  getProductBycategoryId: async (req, res) => {
    try {
      let page = parseInt(req.query.page);
      let limit = parseInt(req.query.limit);
      let skip = (page - 1) * limit;

      let cond = {
        $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }],
      };

      cond.status = "verified";

      if (req?.query?.category && req?.query?.category !== "all") {
        const cat = await Category.findOne({ slug: req?.query?.category });

        if (cat) {
          cond.category = cat._id;
        } else {
          return response.error(res, { message: "Category not found" });
        }
      }

      if (req?.query?.product_id) {
        cond._id = { $ne: req?.query?.product_id };
      }

      if (req.query.is_new) {
        cond.is_new = true;
      }
      if (req.query.sort_by === "bulk") {
        cond.$expr = { $gt: [{ $size: "$price_slot" }, 1] };
      }

      const totalProducts = await Product.countDocuments(cond);
      const totalPages = Math.ceil(totalProducts / limit);

      let sort_by = { _id: -1 };
      let useAggregation = false;

      if (req.query.sort_by) {
        switch (req.query.sort_by) {
          case "featured":
          case "new":
            sort_by.createdAt = -1;
            break;
          case "old":
            sort_by.createdAt = 1;
            break;
          case "is_top":
            sort_by.sold_pieces = -1;
            break;
          case "a_z":
            sort_by.name = 1;
            break;
          case "z_a":
            sort_by.name = -1;
            break;
          case "low":
            useAggregation = true;
            break;
          case "high":
            useAggregation = true;
            break;
          default:
            sort_by.createdAt = -1;
        }
      } else {
        sort_by.createdAt = -1;
      }

      let product;

      if (useAggregation) {
        let sortDirection = req.query.sort_by === "low" ? 1 : -1;

        product = await Product.aggregate([
          { $match: cond },
          {
            $addFields: {
              numericPrice: {
                $switch: {
                  branches: [
                    // If price_slot.our_price is array, get first element
                    {
                      case: {
                        $eq: [{ $type: "$price_slot.our_price" }, "array"],
                      },
                      then: {
                        $convert: {
                          input: { $arrayElemAt: ["$price_slot.our_price", 0] },
                          to: "double",
                          onError: 0,
                          onNull: 0,
                        },
                      },
                    },
                    {
                      case: {
                        $eq: [{ $type: "$price_slot.our_price" }, "string"],
                      },
                      then: {
                        $convert: {
                          input: "$price_slot.our_price",
                          to: "double",
                          onError: 0,
                          onNull: 0,
                        },
                      },
                    },
                    {
                      case: {
                        $eq: [{ $type: "$price_slot.our_price" }, "double"],
                      },
                      then: "$price_slot.our_price",
                    },
                    {
                      case: {
                        $eq: [{ $type: "$price_slot.our_price" }, "int"],
                      },
                      then: "$price_slot.our_price",
                    },
                    {
                      case: {
                        $eq: [{ $type: "$price_slot.our_price" }, "decimal"],
                      },
                      then: {
                        $convert: {
                          input: "$price_slot.our_price",
                          to: "double",
                          onError: 0,
                          onNull: 0,
                        },
                      },
                    },
                  ],
                  default: 0,
                },
              },
            },
          },
          {
            $sort: {
              numericPrice: sortDirection,
              _id: 1, // 👈 IMPORTANT
            },
          },
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: "categories", // replace with your category collection name
              localField: "category",
              foreignField: "_id",
              as: "category",
            },
          },
          {
            $unwind: {
              path: "$category",
              preserveNullAndEmptyArrays: true,
            },
          },
        ]);
      } else {
        // Normal Mongoose query
        product = await Product.find(cond)
          .populate("category")
          .sort({ ...sort_by, _id: -1 })
          .skip(skip)
          .limit(limit);
      }

      return res.status(200).json({
        status: true,
        data: product,
        pagination: {
          totalItems: totalProducts,
          totalPages: totalPages,
          currentPage: page,
          itemsPerPage: limit,
        },
      });
    } catch (error) {
      return response.error(res, error);
    }
  },

  getColors: async (req, res) => {
    try {
      let product = await Product.aggregate([
        { $unwind: "$varients" },
        {
          $group: {
            _id: null, // We don't need to group by a specific field, so use null
            uniqueColors: { $addToSet: "$varients.color" }, // $addToSet ensures uniqueness
          },
        },
        {
          $project: {
            _id: 0, // Exclude _id from the output
            uniqueColors: 1,
          },
        },
      ]);

      return response.ok(res, product[0]);
    } catch (error) {
      return response.error(res, error);
    }
  },

  updateProduct: async (req, res) => {
    try {
      const payload = req?.body || {};
      if (!payload.slug || payload.slug.trim() === "") {
        payload.slug = payload.name
          .toLowerCase()
          .replace(/ /g, "-")
          .replace(/[^\w-]+/g, "");
      }
      let product = await Product.findByIdAndUpdate(payload?.id, payload, {
        new: true,
        upsert: true,
      });
      return response.ok(res, product);
    } catch (error) {
      return response.error(res, error);
    }
  },

  topselling: async (req, res) => {
    try {
      let product = await Product.find({ is_top: true, soldp });
      return response.ok(res, product);
    } catch (error) {
      return response.error(res, error);
    }
  },

  getnewitem: async (req, res) => {
    try {
      let product = await Product.find({ is_new: true });
      return response.ok(res, product);
    } catch (error) {
      return response.error(res, error);
    }
  },

  deleteProduct: async (req, res) => {
    try {
      const product = await Product.findById(req?.params?.id);

      if (!product) {
        return response.notFound(res, { message: "Product not found" });
      }

      product.isDeleted = true;
      await product.save();

      return response.ok(res, { message: "Deleted successfully" });
    } catch (error) {
      return response.error(res, error);
    }
  },

  deleteAllProduct: async (req, res) => {
    try {
      const newid = req.body.products.map(
        (f) => new mongoose.Types.ObjectId(f)
      );
      await Product.deleteMany({ _id: { $in: newid } });
      return response.ok(res, { meaasge: "Deleted successfully" });
    } catch (error) {
      return response.error(res, error);
    }
  },

  requestProduct: async (req, res) => {
    try {
      const payload = req?.body || {};

      const storePrefix = "BHH";

      const lastOrder = await ProductRequest.findOne()
        .sort({ createdAt: -1 })
        .lean();

      let orderNumber = 1;

      if (lastOrder && lastOrder.orderId) {
        const match = lastOrder.orderId.match(/-(\d{2})$/);
        if (match && match[1]) {
          orderNumber = parseInt(match[1], 10) + 1;
        }
      }

      const centralTime = DateTime.now().setZone("America/Chicago");

      const yy = String(centralTime.year).slice(2); // last 2 digits of year
      const mm = String(centralTime.month).padStart(2, "0");
      const dd = String(centralTime.day).padStart(2, "0");
      const hours = String(centralTime.hour).padStart(2, "0");
      const minutes = String(centralTime.minute).padStart(2, "0");

      const datePart = `${yy}${mm}${dd}`;
      const timePart = `${hours}${minutes}`;
      const orderPart = String(orderNumber).padStart(2, "0");

      const generatedOrderId = `${storePrefix}-${datePart}-${timePart}-${orderPart}`;

      payload.orderId = generatedOrderId;
      payload.orderTime = centralTime.toFormat("HH:mm");
      payload.orderDate = centralTime.toFormat("MM-dd-yyyy");
      let userReq = await User.findById(req.user.id);
      let user = decryptObject(userReq);

      for (const productItem of payload.productDetail) {
        const product = await Product.findById(productItem.product);

        if (!product) {
          return response.error(
            res,
            `Product not found: ${productItem.product}`
          );
        }

        if (product.Quantity - productItem.qty < 0) {
          return response.error(res, {
            message: `Insufficient stock for product: ${product.name}. Available: ${product.Quantity}, Requested: ${productItem.qty}`,
          });
        }

        const sale = await FlashSale.findOne({
          _id: productItem?.saleID,
          status: "ACTIVE",
          endDateTime: { $gt: new Date() },
        });

        if (productItem?.productSource === "NORMAL") {
          const cartPrice = Number(productItem.price);
          const livePrice = Number(product.price_slot[0].our_price);

          if (cartPrice !== livePrice) {
            return response.error(res, {
              message: `${product.name} price updated. Remove the item and add it again to continue.`,
            });
          }
        }

        if (productItem?.productSource === "SALE") {
          const cartPrice = Number(productItem?.price);
          const liveSalePrice = Number(sale?.price);

          if (!liveSalePrice) {
            return response.error(res, {
              message: "Sale price not available. Please try again.",
            });
          }

          if (cartPrice !== liveSalePrice) {
            return response.error(res, {
              message: `${product.name} price updated. Remove the item and add it again to continue.`,
            });
          }
        }
      }

      if (payload.isLocalDelivery || payload?.isShipmentDelivery) {
        let shipmetCosts = await ShippingCost.find();

        if (payload.isLocalDelivery) {
          const requiredFields = ["address", "name", "phoneNumber"];
          const missingFields = [];
          const deliveryAddress = {
            ...payload.Local_address,
            address: user.address || "",
            name: user.username || "",
            phoneNumber: user.number || "",
            email: user.email || "",
            lastname: user.lastname || "",
            ApartmentNo: user.ApartmentNo || "",
            SecurityGateCode: user.SecurityGateCode || "",
            BusinessAddress: user.BusinessAddress || "",
            location: user.location || "",
            zipcode: user.zipcode || "",
          };
          requiredFields.forEach((field) => {
            if (!deliveryAddress[field]) {
              missingFields.push(field);
            }
          });

          if (missingFields.length > 0) {
            return response.error(
              res,
              `Please provide the following delivery details: ${missingFields.join(
                ", "
              )}`
            );
          }

          payload.Local_address = deliveryAddress;
        } else {
          payload.Local_address = {
            ...payload.Local_address,
            address: user.address || "",
            name: user.username || "",
            phoneNumber: user.number || "",
            email: user.email || "",
            lastname: user.lastname || "",
            ApartmentNo: user.ApartmentNo || "",
            SecurityGateCode: user.SecurityGateCode || "",
            BusinessAddress: user.BusinessAddress || "",
            location: user.location,
            zipcode: user.zipcode || "",
          };
        }

        if (payload.isLocalDelivery) {
          if (payload.subtotal < shipmetCosts[0].minShippingCostforLocal) {
            payload.deliveryfee = shipmetCosts[0].ShippingCostforLocal;
          }
          if (payload.subtotal < shipmetCosts[0].minServiesCost) {
            payload.serviceFee = shipmetCosts[0].serviesCost;
          }
        } else if (payload?.isShipmentDelivery) {
          if (payload.subtotal < shipmetCosts[0].minShipmentCostForShipment) {
            payload.deliveryfee = shipmetCosts[0].ShipmentCostForShipment;
          }
        }
      }
      const newOrder = new ProductRequest(payload);
      // newOrder.Deliverytip = payload.DeliveryTip
      newOrder.orderId = generatedOrderId;

      if (payload?.discountCode) {
        const coupan = await Coupon.findOne({ code: payload?.discountCode });
        const isOnce = coupan.ussageType === "once";
        // // // console.log("abcd", coupan, isOnce);
        if (isOnce) {
          if (coupan) {
            const alreadyUsed = coupan.userId?.some(
              (id) => id.toString() === payload.user.toString()
            );

            if (alreadyUsed) {
              return response.error(res, "User already used this coupon");
            }
            coupan.userId.push(payload.user);
            await coupan.save();
            // // // console.log("User ID added to coupon");
          } else {
            return response.error(res, "Coupon not found");
          }
        }
      }

      await newOrder.save();

      return response.ok(res, {
        message: "Product request added successfully",
        orders: newOrder,
      });
    } catch (error) {
      return response.error(res, error);
    }
  },

  newRequestProduct: async (req, res) => {
    try {
      const payload = req?.body || {};

      const storePrefix = "BHH";

      const lastOrder = await ProductRequest.findOne()
        .sort({ createdAt: -1 })
        .lean();

      let orderNumber = 1;

      if (lastOrder && lastOrder.orderId) {
        const match = lastOrder.orderId.match(/-(\d{2})$/);
        if (match && match[1]) {
          orderNumber = parseInt(match[1], 10) + 1;
        }
      }

      const centralTime = DateTime.now().setZone("America/Chicago");

      const yy = String(centralTime.year).slice(2); // last 2 digits of year
      const mm = String(centralTime.month).padStart(2, "0");
      const dd = String(centralTime.day).padStart(2, "0");
      const hours = String(centralTime.hour).padStart(2, "0");
      const minutes = String(centralTime.minute).padStart(2, "0");

      const datePart = `${yy}${mm}${dd}`;
      const timePart = `${hours}${minutes}`;
      const orderPart = String(orderNumber).padStart(2, "0");

      const generatedOrderId = `${storePrefix}-${datePart}-${timePart}-${orderPart}`;

      payload.orderId = generatedOrderId;
      payload.orderTime = centralTime.toFormat("HH:mm");
      payload.orderDate = centralTime.toFormat("MM-dd-yyyy");
      let userReq = await User.findById(req.user.id);
      let user = decryptObject(userReq);
      for (const productItem of payload.productDetail) {
        const product = await Product.findById(productItem.product);

        if (!product) {
          return response.error(
            res,
            `Product not found: ${productItem.product}`
          );
        }

        if (product.Quantity - productItem.qty < 0) {
          return response.error(res, {
            message: `Insufficient stock for product: ${product.name}. Available: ${product.Quantity}, Requested: ${productItem.qty}`,
          });
        }

        // let price = productItem.total = Number(productItem.total) / Number(productItem.qty) || Number(productItem.price) / Number(productItem.qty)
        // // // // console.log("price", price, productItem.price, productItem.total, product.price_slot[0].our_price);
        // if (Number(price) < Number(product.price_slot[0].our_price)) {
        //   return response.error(
        //     res,
        //     { message: `${product.name} price updated. Remove the item and add it again to continue.` }
        //   );
        // }
      }

      if (payload.isLocalDelivery || payload?.isShipmentDelivery) {
        let shipmetCosts = await ShippingCost.find();

        if (payload.isLocalDelivery) {
          const requiredFields = ["address", "name", "phoneNumber"];
          const missingFields = [];
          const deliveryAddress = {
            ...payload.Local_address,
            address: user.address || "",
            name: user.username || "",
            phoneNumber: user.number || "",
            email: user.email || "",
            lastname: user.lastname || "",
            ApartmentNo: user.ApartmentNo || "",
            SecurityGateCode: user.SecurityGateCode || "",
            BusinessAddress: user.BusinessAddress || "",
            location: user.location || "",
            zipcode: user.zipcode || "",
          };
          requiredFields.forEach((field) => {
            if (!deliveryAddress[field]) {
              missingFields.push(field);
            }
          });

          if (missingFields.length > 0) {
            return response.error(
              res,
              `Please provide the following delivery details: ${missingFields.join(
                ", "
              )}`
            );
          }

          payload.Local_address = deliveryAddress;
        } else {
          payload.Local_address = {
            ...payload.Local_address,
            address: user.address || "",
            name: user.username || "",
            phoneNumber: user.number || "",
            email: user.email || "",
            lastname: user.lastname || "",
            ApartmentNo: user.ApartmentNo || "",
            SecurityGateCode: user.SecurityGateCode || "",
            BusinessAddress: user.BusinessAddress || "",
            location: user.location,
            zipcode: user.zipcode || "",
          };
        }

        if (payload.isLocalDelivery) {
          if (payload.subtotal < 35) {
            payload.deliveryfee = shipmetCosts[0].ShippingCostforLocal;
          }
        } else if (payload?.isShipmentDelivery) {
          if (payload.subtotal < 200) {
            payload.deliveryfee = shipmetCosts[0].ShipmentCostForShipment;
          }
        }
      }
      // // // console.log(payload);
      const newOrder = new ProductRequest(payload);
      // newOrder.Deliverytip = payload.DeliveryTip
      newOrder.orderId = generatedOrderId;

      if (payload?.discountCode) {
        const coupan = await Coupon.findOne({ code: payload?.discountCode });
        const isOnce = coupan.ussageType === "once";
        // // // console.log("abcd", coupan, isOnce);
        if (isOnce) {
          if (coupan) {
            const alreadyUsed = coupan.userId?.some(
              (id) => id.toString() === payload.user.toString()
            );

            if (alreadyUsed) {
              return response.error(res, "User already used this coupon");
            }
            coupan.userId.push(payload.user);
            await coupan.save();
            // // // console.log("User ID added to coupon");
          } else {
            return response.error(res, "Coupon not found");
          }
        }
      }

      // // // console.log("newOrder", newOrder);
      await newOrder.save();

      return response.ok(res, {
        message: "Product request added successfully",
        orders: newOrder,
      });
    } catch (error) {
      return response.error(res, error);
    }
  },

  getTopSoldProduct: async (req, res) => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;

      // const products = await Product.aggregate([
      //   {
      //     // ✅ Correct match condition
      //     $match: {
      //       status: "verified",
      //       $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }],
      //     },
      //   },

      //   {
      //     $addFields: {
      //       position: { $ifNull: ["$position", 999999] },
      //     },
      //   },

      //   {
      //     $sort: {
      //       position: 1, // first priority
      //       sold_pieces: -1, // then top sold
      //     },
      //   },

      //   { $skip: (page - 1) * limit },
      //   { $limit: limit },
      // ]);

      const products = await Product.aggregate([
        {
          $match: {
            status: "verified",
            $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }],
          },
        },
        {
          $addFields: {
            sortPosition: { $ifNull: ["$position", 999999] },
            soldCount: { $ifNull: ["$sold_pieces", 0] },
          },
        },

        {
          $sort: {
            sortPosition: 1,
            soldCount: -1,
            _id: 1,
          },
        },
        { $skip: (page - 1) * limit },
        { $limit: limit },
      ]);

      return response.ok(res, products);
    } catch (error) {
      return response.error(res, error);
    }
  },

  getLowStockProduct: async (req, res) => {
    try {
      const { page = 1, limit = 10 } = req.query;

      const products = await Product.find({ Quantity: { $lt: 20 } })
        .sort({ Quantity: 1 })
        .limit(Number(limit))
        .skip((page - 1) * limit);

      return response.ok(res, products);
    } catch (error) {
      return response.error(res, error);
    }
  },

  updateProductRequest: async (req, res) => {
    try {
      const { id, parkingNo, SecretCode, status, carColor, carBrand } =
        req.body;

      if (!id) {
        return response.error(res, "Product request ID is required");
      }

      const productRequest = await ProductRequest.findById(id);
      if (!productRequest) {
        return response.error(res, "Product request not found");
      }

      if (parkingNo !== undefined) {
        productRequest.parkingNo = parkingNo;
        productRequest.carBrand = carBrand;
        productRequest.carColor = carColor;
      }

      // // // console.log(productRequest.SecretCode);

      if (SecretCode !== undefined) {
        if (!productRequest.SecretCode) {
          productRequest.SecretCode = String(SecretCode).trim();
        } else {
          if (status !== undefined) {
            if (
              String(productRequest.SecretCode).trim() ===
              String(SecretCode).trim()
            ) {
              productRequest.status = status;
            } else {
              return response.error(res, "Invalid Secret Code");
            }
          } else {
            productRequest.SecretCode = String(SecretCode).trim();
          }
        }
      }

      if (parkingNo || carBrand || carColor) {
        await mailNotification.addParkingSpot({
          parkingSpot: parkingNo,
          carBrand: carBrand,
          carColor: carColor,
          orderId: productRequest.orderId,
        });

        await notify(
          productRequest.user,
          "Parking Spot Added",
          `Your parking spot has been added for order ID ${productRequest.orderId}.`,
          productRequest.orderId
        );
      }

      const updatedRequest = await productRequest.save();

      return response.ok(res, {
        message: "Product request updated successfully",
        order: updatedRequest,
      });
    } catch (error) {
      return response.error(res, error.message || "An error occurred");
    }
  },

  getSecrectCode: async (req, res) => {
    try {
      const { id, SecretCode } = req.body;

      if (!id) {
        return response.error(res, "Product request ID is required");
      }

      const productRequest = await ProductRequest.findById(id).populate(
        "user",
        "user_email user_first_name user_phone _id"
      );

      if (!productRequest) {
        return response.error(res, "Product request not found");
      }

      let userEmail = decryptValue(productRequest.user.user_email);
      let userPhone = decryptValue(productRequest.user.user_phone);
      let username = decryptValue(productRequest.user.user_first_name);

      if (SecretCode !== undefined) {
        productRequest.SecretCode = String(SecretCode).trim();
      }

      await mailNotification.customerReachStore({
        Name: username,
        mobileNo: userPhone,
        email: userEmail,
        orderId: productRequest.orderId,
      });

      await notify(
        productRequest.user._id,
        "Secret Code Updated",
        `Your secret code has been updated for order ID ${productRequest.orderId}.`,
        productRequest.orderId
      );

      await productRequest.save();
      const updatedRequest = await ProductRequest.findById(productRequest._id)
        .populate("user", "user_email user_first_name user_phone _id")
        .lean();

      let user = decryptObject(updatedRequest.user);

      return response.ok(res, {
        message: "Product request updated successfully",
        order: { ...updatedRequest, user: { ...user } },
      });
    } catch (error) {
      return response.error(res, error.message || "An error occurred");
    }
  },

  updateTrackingInfo: async (req, res) => {
    try {
      const { id, trackingNo, trackingLink, driverId } = req.body;

      if (!id) {
        return response.error(res, "Product request ID is required");
      }

      const productRequest = await ProductRequest.findById(id).populate(
        "user",
        "user_email user_first_name user_phone _id"
      );
      let userEmail = decryptValue(productRequest.user.user_email);

      if (!productRequest) {
        return response.error(res, "Product request not found");
      }

      if (trackingNo !== undefined && trackingNo !== "") {
        productRequest.trackingNo = trackingNo;
      }

      if (trackingLink !== undefined && trackingLink !== "") {
        productRequest.trackingLink = trackingLink;
      }

      if (driverId !== undefined && driverId !== "") {
        productRequest.driver_id = driverId;
      }

      productRequest.status = "Shipped";
      if (productRequest.isShipmentDelivery) {
        await mailNotification.sendTrackingInfoEmail({
          email: userEmail,
          orderId: productRequest.orderId,
          trackingNo: productRequest.trackingNo,
          shippingCompany: productRequest.trackingLink,
        });
      } else {
        await mailNotification.sendDriverInfoEmail({
          email: userEmail,
          orderId: productRequest.orderId,
          driverId: productRequest.driver_id,
        });
      }

      await notify(
        productRequest.user._id,
        "Tracking Info Updated",
        `Your order with ID ${productRequest.orderId} has been shipped.`,
        productRequest.orderId
      );

      await productRequest.save();
      const updatedRequest = await ProductRequest.findById(productRequest._id)
        .populate("user", "user_email user_first_name user_phone _id")
        .lean();

      let user = decryptObject(updatedRequest.user);

      return response.ok(res, {
        message: "Tracking info updated successfully",
        order: { ...updatedRequest, user: { ...user } },
      });
    } catch (error) {
      // // // console.log(error);
      return response.error(res, error.message || "An error occurred");
    }
  },

  cancalOrder: async (req, res) => {
    try {
      const { id } = req.body;

      if (!id) {
        return response.error(res, "Product request ID is required");
      }

      const productRequest = await ProductRequest.findById(id).populate(
        "user",
        "user_email _id"
      );
      if (!productRequest) {
        return response.error(res, "Product request not found");
      }

      const createdTime = new Date(productRequest.createdAt);
      const now = new Date();
      const diffInMinutes = (now - createdTime) / (1000 * 60);

      if (diffInMinutes > 15) {
        return response.error(res, {
          message: "Order can only be canceled within 15 minutes of creation",
        });
      }

      productRequest.status = "Cancel";
      await productRequest.save();
      let userEmail = decryptValue(productRequest.user.user_email);
      await mailNotification.orderCancelAdmin({
        email: userEmail,
        orderId: productRequest.orderId,
      });

      await mailNotification.orderCancel({
        email: userEmail,
        orderId: productRequest.orderId,
      });
      await notify(
        productRequest.user._id,
        "Order Canceled",
        `Your order with ID ${productRequest.orderId} has been canceled.`,
        productRequest.orderId
      );
      const updatedRequest = await ProductRequest.findById(productRequest._id)
        .populate("user", "user_email user_first_name user_phone _id")
        .lean();

      let user = decryptObject(updatedRequest.user);

      return response.ok(res, {
        message: "Order canceled successfully",
        order: { ...updatedRequest, user: { ...user } },
      });
    } catch (error) {
      // // // console.error(error); // show stack trace
      return response.error(res, error.message || "An error occurred");
    }
  },

  cancalOrderfromAdmin: async (req, res) => {
    try {
      const { id, reason } = req.body;

      if (!id) {
        return response.error(res, "Product request ID is required");
      }

      const productRequest = await ProductRequest.findById(id).populate(
        "user",
        "user_email _id"
      );

      if (!productRequest) {
        return response.error(res, "Product request not found");
      }
      let userEmail = decryptValue(productRequest.user.user_email);

      productRequest.status = "Cancel";
      await productRequest.save();

      await mailNotification.orderCancelByAdmin({
        email: userEmail,
        orderId: productRequest.orderId,
        reason: reason,
      });

      await notify(
        productRequest.user._id,
        "Order Canceled by Admin",
        `Your order with ID ${productRequest.orderId} has been canceled by the admin.`,
        productRequest.orderId
      );
      const updatedRequest = await ProductRequest.findById(productRequest._id)
        .populate("user", "user_email _id")
        .lean();

      let user = decryptObject(updatedRequest.user);

      return response.ok(res, {
        message: "Order canceled successfully",
        order: { ...updatedRequest, user: { ...user } },
      });
    } catch (error) {
      // // // console.error(error); // show stack trace
      return response.error(res, error.message || "An error occurred");
    }
  },
  switchToShipment: async (req, res) => {
    try {
      const { id } = req.body;

      if (!id) {
        return response.error(res, "Product request ID is required");
      }
      // // // console.log("request comes here ", id);
      const productRequest = await ProductRequest.findById(id).populate(
        "user",
        "user_email _id"
      );

      if (!productRequest) {
        return response.error(res, "Product request not found");
      }
      let userEmail = decryptValue(productRequest.user.user_email);

      productRequest.status = "Pending";
      productRequest.isShipmentDelivery = true;
      productRequest.isLocalDelivery = false;

      await productRequest.save();
      await mailNotification.orderConvertedToShipmentByAdmin({
        email: userEmail,
        orderId: productRequest.orderId,
      });

      await notify(
        productRequest.user._id,
        "Order Switched to Shipment",
        `Your order with ID ${productRequest.orderId} has been switched to shipment.`,
        productRequest.orderId
      );
      const updatedRequest = await ProductRequest.findById(productRequest._id)
        .populate("user", "user_email _id")
        .lean();

      let user = decryptObject(updatedRequest.user);

      return response.ok(res, {
        message: "Order switched to shipment successfully",
        order: { ...updatedRequest, user: { ...user } },
      });
    } catch (error) {
      // // // console.error("Switch to shipment error:", error);
      return response.error(
        res,
        error.message || "An error occurred while switching to shipment"
      );
    }
  },

  RequestForReturn: async (req, res) => {
    try {
      const { id } = req.body;

      if (!id) {
        return response.error(res, "Order ID is required");
      }

      const productRequest = await ProductRequest.findById(id).populate(
        "user",
        "user_email _id"
      );
      if (!productRequest) {
        return response.error(res, "Order not found");
      }
      let userEmail = decryptValue(productRequest.user.user_email);

      productRequest.status = "Return Requested";
      await productRequest.save();

      await mailNotification.orderReturnRequested({
        email: userEmail,
        orderId: productRequest.orderId,
      });

      await notify(
        productRequest.user._id,
        "Return Request Submitted",
        `Your return request for order ID ${productRequest.orderId} has been submitted successfully.`,
        productRequest.orderId
      );
      const updatedRequest = await ProductRequest.findById(productRequest._id)
        .populate("user", "user_email _id")
        .lean();

      let user = decryptObject(updatedRequest.user);

      return response.ok(res, {
        message:
          "Return request submitted successfully. Please check your email for further instructions regarding your product return.",
        order: { ...updatedRequest, user: { ...user } },
      });
    } catch (error) {
      // // // console.error(error); // show stack trace
      return response.error(res, error.message || "An error occurred");
    }
  },
  ReturnConform: async (req, res) => {
    try {
      const { id } = req.body;

      if (!id) {
        return response.error(res, "Order ID is required");
      }

      const productRequest = await ProductRequest.findById(id).populate(
        "user",
        "user_email _id"
      );
      if (!productRequest) {
        return response.error(res, "Order not found");
      }
      let userEmail = decryptValue(productRequest.user.user_email);

      if ((productRequest.status = "Return Requested")) {
        productRequest.status = "Return";
      } else {
        return response.error(res, "Return Request Not Found");
      }

      await mailNotification.orderReturnSuccess({
        email: userEmail,
        orderId: productRequest.orderId,
      });

      await notify(
        productRequest.user._id,
        "Order Return Confirmed",
        `Your return for order ID ${productRequest.orderId} has been confirmed successfully.`,
        productRequest.orderId
      );
      const updatedRequest = await ProductRequest.findByIdAndUpdate(
        productRequest._id,
        productRequest
      )
        .populate("user", "user_email _id")
        .lean();

      let user = decryptObject(updatedRequest.user);

      return response.ok(res, {
        message: "Order Return successfully",
        order: { ...updatedRequest, user: { ...user } },
      });
    } catch (error) {
      // // // console.error(error); // show stack trace
      return response.error(res, error.message || "An error occurred");
    }
  },

  getrequestProduct: async (req, res) => {
    try {
      const product = await ProductRequest.find()
        .populate("user category", "-password -varients")
        .sort({ createdAt: -1 })
        .lean();
      let newupdatedRequest = decryptPopulatedData(product, "user");
      return response.ok(res, newupdatedRequest);
    } catch (error) {
      return response.error(res, error);
    }
  },

  getStatusCompletedProducts: async (req, res) => {
    try {
      const products = await ProductRequest.aggregate([
        {
          $match: {
            user: new mongoose.Types.ObjectId(req.user.id),
            status: "Completed",
            $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }],
          },
        },
        {
          $unwind: {
            path: "$productDetail",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "products",
            localField: "productDetail.product",
            foreignField: "_id",
            as: "productDetail.product",
            pipeline: [
              {
                $project: { name: 1 },
              },
            ],
          },
        },
        {
          $unwind: {
            path: "$productDetail.product",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $sort: { createdAt: -1 },
        },
      ]);

      return response.ok(res, products);
    } catch (error) {
      return response.error(res, error.message);
    }
  },

  getOrderBySeller: async (req, res) => {
    try {
      const cond = {};

      if (req.body.curentDate) {
        const date = new Date(req.body.curentDate);
        const nextDay = new Date(date);
        nextDay.setDate(date.getDate() + 1);
        cond.createdAt = { $gte: date, $lte: nextDay };
      }

      if (req.body.orderId) {
        const orderId = req.body.orderId.trim();
        if (orderId.length > 0) {
          cond.orderId = { $regex: orderId, $options: "i" };
        }
      }

      if (req.body.PickupOption) {
        if (req.body.PickupOption === "All") {
        } else if (req.body.PickupOption === "Cancel") {
          cond.status = "Cancel";
        } else {
          const fieldMapping = {
            InStorePickup: "isOrderPickup",
            CurbsidePickup: "isDriveUp",
            NextdayDelivery: "isLocalDelivery",
            Shipment: "isShipmentDelivery",
          }[req.body.PickupOption];

          if (fieldMapping) {
            cond[fieldMapping] = true;
          }
        }
      }

      if (req.body.pickupDate) {
        const pickup = new Date(req.body.pickupDate);
        const startOfDay = new Date(
          Date.UTC(
            pickup.getUTCFullYear(),
            pickup.getUTCMonth(),
            pickup.getUTCDate(),
            0,
            0,
            0,
            0
          )
        );
        const endOfDay = new Date(
          Date.UTC(
            pickup.getUTCFullYear(),
            pickup.getUTCMonth(),
            pickup.getUTCDate(),
            23,
            59,
            59,
            999
          )
        );

        const pickupOption = req.body.PickupOption;

        if (
          pickupOption === "InStorePickup" ||
          pickupOption === "CurbsidePickup"
        ) {
          cond.dateOfDelivery = {
            $gte: startOfDay,
            $lte: endOfDay,
          };
        } else if (
          pickupOption === "NextdayDelivery" ||
          pickupOption === "Shipment"
        ) {
          cond.$or = [
            {
              "Local_address.dateOfDelivery": {
                $gte: startOfDay,
                $lte: endOfDay,
              },
            },
            {
              "Local_address.dateOfDelivery": {
                $gte: startOfDay.toISOString(),
                $lte: endOfDay.toISOString(),
              },
            },
          ];
        } else if (pickupOption === "All") {
          cond.$or = [
            {
              dateOfDelivery: {
                $gte: startOfDay,
                $lte: endOfDay,
              },
            },
            {
              "Local_address.dateOfDelivery": {
                $gte: startOfDay,
                $lte: endOfDay,
              },
            },
            {
              "Local_address.dateOfDelivery": {
                $gte: startOfDay.toISOString(),
                $lte: endOfDay.toISOString(),
              },
            },
          ];
        }
      }

      // // // console.log(cond);

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const products = await ProductRequest.find(cond)
        .populate("user", "-password -varients")
        .populate("productDetail.product")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
      let newupdatedRequest = decryptPopulatedData(products, "user");
      const totalItems = await ProductRequest.countDocuments(cond);

      return res.status(200).json({
        status: true,
        data: newupdatedRequest.map((item, index) => ({
          ...(item.toObject?.() || item),
          indexNo: skip + index + 1,
        })),
        pagination: {
          totalItems,
          totalPages: Math.ceil(totalItems / limit),
          currentPage: page,
          itemsPerPage: limit,
        },
      });
    } catch (error) {
      // // // console.error("Error in getOrderBySeller:", error);
      return res.status(500).json({
        status: false,
        message: error.message || "An error occurred",
      });
    }
  },

  NewgetOrderBySeller: async (req, res) => {
    try {
      const cond = {};

      if (req.body.curentDate) {
        const date = new Date(req.body.curentDate);
        const nextDay = new Date(date);
        nextDay.setDate(date.getDate() + 1);
        cond.createdAt = { $gte: date, $lte: nextDay };
      }

      if (req.body.orderId) {
        const orderId = req.body.orderId.trim();
        if (orderId.length > 0) {
          cond.orderId = { $regex: orderId, $options: "i" };
        }
      }

      if (req.body.PickupOption) {
        if (req.body.PickupOption === "All") {
        } else if (req.body.PickupOption === "Cancel") {
          cond.status = "Cancel";
        } else {
          const fieldMapping = {
            InStorePickup: "isOrderPickup",
            CurbsidePickup: "isDriveUp",
            NextdayDelivery: "isLocalDelivery",
            Shipment: "isShipmentDelivery",
          }[req.body.PickupOption];

          if (fieldMapping) {
            cond[fieldMapping] = true;
          }
        }
      }

      if (req.body.pickupDate) {
        const pickup = new Date(req.body.pickupDate);
        const startOfDay = new Date(
          Date.UTC(
            pickup.getUTCFullYear(),
            pickup.getUTCMonth(),
            pickup.getUTCDate(),
            0,
            0,
            0,
            0
          )
        );
        const endOfDay = new Date(
          Date.UTC(
            pickup.getUTCFullYear(),
            pickup.getUTCMonth(),
            pickup.getUTCDate(),
            23,
            59,
            59,
            999
          )
        );

        const pickupOption = req.body.PickupOption;

        if (
          pickupOption === "InStorePickup" ||
          pickupOption === "CurbsidePickup"
        ) {
          cond.dateOfDelivery = {
            $gte: startOfDay,
            $lte: endOfDay,
          };
        } else if (
          pickupOption === "NextdayDelivery" ||
          pickupOption === "Shipment"
        ) {
          cond.$or = [
            {
              "Local_address.dateOfDelivery": {
                $gte: startOfDay,
                $lte: endOfDay,
              },
            },
            {
              "Local_address.dateOfDelivery": {
                $gte: startOfDay.toISOString(),
                $lte: endOfDay.toISOString(),
              },
            },
          ];
        } else if (pickupOption === "All") {
          cond.$or = [
            {
              dateOfDelivery: {
                $gte: startOfDay,
                $lte: endOfDay,
              },
            },
            {
              "Local_address.dateOfDelivery": {
                $gte: startOfDay,
                $lte: endOfDay,
              },
            },
            {
              "Local_address.dateOfDelivery": {
                $gte: startOfDay.toISOString(),
                $lte: endOfDay.toISOString(),
              },
            },
          ];
        }
      }

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      cond.$and = [
        {
          $or: [
            { paymentStatus: { $in: ["Succeeded", "Paid"] } },
            { paymentStatus: { $exists: false } },
          ],
        },
        {
          $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }],
        },
      ];

      const products = await ProductRequest.find(cond)
        .populate("user", "-password -varients")
        .populate("productDetail.product")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
      let newupdatedRequest = decryptPopulatedData(products, "user");
      const totalItems = await ProductRequest.countDocuments(cond);

      return res.status(200).json({
        status: true,
        data: newupdatedRequest.map((item, index) => ({
          ...(item.toObject?.() || item),
          indexNo: skip + index + 1,
        })),
        pagination: {
          totalItems,
          totalPages: Math.ceil(totalItems / limit),
          currentPage: page,
          itemsPerPage: limit,
        },
      });
    } catch (error) {
      // // // console.error("Error in getOrderBySeller:", error);
      return res.status(500).json({
        status: false,
        message: error.message || "An error occurred",
      });
    }
  },

  FailedOrder: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
      const cond = {
        paymentStatus: { $in: ["Pending", "Failed"] },
        $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }],
      };

      const products = await ProductRequest.find(cond)
        .populate("user", "-password -varients")
        .populate("productDetail.product")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
      let newupdatedRequest = decryptPopulatedData(products, "user");
      const totalItems = await ProductRequest.countDocuments(cond);

      return res.status(200).json({
        status: true,
        data: newupdatedRequest.map((item, index) => ({
          ...(item.toObject?.() || item),
          indexNo: skip + index + 1,
        })),
        pagination: {
          totalItems,
          totalPages: Math.ceil(totalItems / limit),
          currentPage: page,
          itemsPerPage: limit,
        },
      });
    } catch (error) {
      // // // console.error("Error in getOrderBySeller:", error);
      return res.status(500).json({
        status: false,
        message: error.message || "An error occurred",
      });
    }
  },
  DeleteOrder: async (req, res) => {
    try {
      const { orderId } = req.params;

      if (!orderId) {
        return res.status(400).json({
          status: false,
          message: "Order ID is required",
        });
      }

      const order = await ProductRequest.findById(orderId);

      if (!order) {
        return res.status(404).json({
          status: false,
          message: "Order not found",
        });
      }

      order.isDeleted = true;
      await order.save();

      return res.status(200).json({
        status: true,
        message: "Order deleted successfully",
      });
    } catch (error) {
      // // // console.error("Error in DeleteOrder:", error);
      return res.status(500).json({
        status: false,
        message: error.message || "An error occurred",
      });
    }
  },

  getAssignedOrder: async (req, res) => {
    try {
      let cond = {
        status: { $ne: "Cancel" }, // Exclude cancelled orders
      };

      if (req.user.type === "SELLER") {
        cond = {
          ...cond,
          seller_id: req.user.id,
          status: "Driverassigned",
        };
      } else if (req.user.type === "DRIVER") {
        // For drivers, only show orders assigned to them
        cond = {
          ...cond,
          driver_id: req.user.id,
          status: "Driverassigned",
        };
      }

      const product = await ProductRequest.find(cond)
        .populate("user", "-password")
        .populate("productDetail.product")
        .sort({ createdAt: -1 })
        .lean();
      let newupdatedRequest = decryptPopulatedData(product, "user");
      return response.ok(res, newupdatedRequest);
    } catch (error) {
      // // // console.error("Error in getAssignedOrder:", error);
      return response.error(res, error);
    }
  },

  changeorderstatus: async (req, res) => {
    try {
      const product = await ProductRequest.findById(req.body.id).populate(
        "user",
        "user_email _id"
      );
      let userEmail = decryptValue(product.user.user_email);
      product.status = req.body.status;

      if (req.body.status === "Completed") {
        await mailNotification.orderDelivered({
          email: userEmail,
          orderId: product.orderId,
        });
      }

      await notify(
        product.user._id,
        "Order Status Updated",
        `Your order with ID ${product.orderId} has been updated to ${product.status}.`,
        product.orderId
      );
      const updatedRequest = await ProductRequest.findByIdAndUpdate(
        product._id,
        product
      )
        .populate("user", "user_email _id")
        .lean();

      let user = decryptObject(updatedRequest.user);
      return response.ok(res, { ...updatedRequest, user: { ...user } });
    } catch (error) {
      return response.error(res, error);
    }
  },

  verifyOrderStatusWithCode: async (req, res) => {
    try {
      const { id, status, SecretCode } = req.body;

      const product = await ProductRequest.findById(id).populate(
        "user",
        "user_email _id"
      );
      if (!product) {
        return response.error(res, "Order not found");
      }
      let userEmail = decryptValue(product.user.user_email);

      if (SecretCode) {
        if (!product.SecretCode) {
          product.SecretCode = String(SecretCode).trim();
        } else {
          if (String(product.SecretCode).trim() !== String(SecretCode).trim()) {
            return response.error(
              res,
              "Verification failed: Invalid Secret Code"
            );
          }
        }
      }

      if (status) {
        product.status = status;

        if (status === "Completed") {
          await mailNotification.orderDelivered({
            email: userEmail,
            orderId: product.orderId,
          });
        }

        await notify(
          product.user._id,
          "Order Status Updated",
          `Your order with ID ${product.orderId} has been updated to ${status}.`,
          product.orderId
        );
      }

      // await product.save();

      const updatedRequest = await ProductRequest.findByIdAndUpdate(
        product._id,
        product
      )
        .populate("user", "user_email")
        .lean();

      let user = decryptObject(updatedRequest.user);
      return response.ok(res, {
        message: "Order status verified and updated successfully",
        product: { ...updatedRequest, user: { ...user } },
      });
    } catch (error) {
      // // // console.error("verifyOrderStatusWithCode error:", error);
      return response.error(res, "Something went wrong");
    }
  },

  AddNote: async (req, res) => {
    try {
      const product = await ProductRequest.findById(req.body.id);
      product.note = req.body.note;
      product.save();
      return response.ok(res, product);
    } catch (error) {
      return response.error(res, error);
    }
  },

  productSearch: async (req, res) => {
    try {
      let cond = {
        status: "verified",
        $and: [
          {
            $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }],
          },
          {
            $or: [
              { name: { $regex: req.query.key, $options: "i" } },
              { categoryName: { $regex: req.query.key, $options: "i" } },
              { vietnamiesName: { $regex: req.query.key, $options: "i" } },
              {
                relatedName: {
                  $elemMatch: { $regex: req.query.key, $options: "i" },
                },
              },
            ],
          },
        ],
      };

      const product = await Product.find(cond).sort({ createdAt: -1 });
      return response.ok(res, product);
    } catch (error) {
      return response.error(res, error);
    }
  },

  updaterequestProduct: async (req, res) => {
    try {
      const product = await ProductRequest.findByIdAndUpdate(
        req.params.id,
        req.body,
        { upsert: true, new: true }
      );
      return response.ok(res, product);
    } catch (error) {
      return response.error(res, error);
    }
  },

  getrequestProductbyid: async (req, res) => {
    try {
      const product = await ProductRequest.findById(req.params.id)
        .populate("user driver_id seller_id", "-password")
        .populate("productDetail.product")
        .lean();
      let newupdatedRequest = decryptObject(product.user);
      return response.ok(res, { ...product, user: { ...newupdatedRequest } });
      // return response.ok(res, product);
    } catch (error) {
      return response.error(res, error);
    }
  },

  nearbyorderfordriver: async (req, res) => {
    const id = req.user.id;
    try {
      let orders = await ProductRequest.find({
        status: "Shipped",
        driver_id: id,
        // location: {
        //   $near: {
        //     $maxDistance: 1609.34 * 10,
        //     $geometry: {
        //       type: "Point",
        //       coordinates: req.body.location,
        //     },
        //   },
        // },
      })
        .populate("user", "-password")
        .lean();
      let newupdatedRequest = decryptPopulatedData(orders, "user");
      return response.ok(res, newupdatedRequest);
    } catch (err) {
      return response.error(res, err);
    }
  },

  getrequestProductbyuser: async (req, res) => {
    try {
      const { page = 1, limit = 20 } = req.query;

      const cond = {
        user: req.user.id,
        $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }],
      };

      const product = await ProductRequest.find(cond)
        .populate("productDetail.product", "-varients")
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort({ createdAt: -1 });

      return response.ok(res, product);
    } catch (error) {
      return response.error(res, error.message);
    }
  },

  NewgetrequestProductbyuser: async (req, res) => {
    try {
      const page = parseInt(req.query.page);
      const limit = parseInt(req.query.limit);

      const cond = {
        user: req.user.id,
        $or: [
          { paymentStatus: { $in: ["Succeeded", "Paid"] } },
          { paymentStatus: { $exists: false } },
        ],
      };

      const products = await ProductRequest.find(cond)
        .populate("productDetail.product", "-varients")
        .limit(limit)
        .skip((page - 1) * limit)
        .sort({ createdAt: -1 });

      return response.ok(res, products);
    } catch (error) {
      return response.error(res, error);
    }
  },

  uploadProducts: async (req, res) => {
    try {
      const products = req.body;

      const insertedProducts = await Product.insertMany(products);
      return res.status(201).json({
        message: "Products uploaded successfully",
        data: insertedProducts,
      });
    } catch (error) {
      return res
        .status(500)
        .json({ message: "Server Error", error: error.message });
    }
  },

  toggleProductStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const product = await Product.findById(id);

      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      product.status = product.status === "verified" ? "suspended" : "verified";
      const updatedProduct = await product.save();

      response.ok(res, {
        message: `Product status changed to ${product.status}`,
        data: updatedProduct,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  orderhistoryfordriver: async (req, res) => {
    try {
      const product = await ProductRequest.find({
        driver_id: req.user.id,
        status: { $in: ["Delivered", "Completed"] },
        isLocalDelivery: true,
      })
        .sort({ createdAt: -1 })
        .populate("user", "-password")
        .lean();
      let newupdatedRequest = decryptPopulatedData(product, "user");
      return response.ok(res, newupdatedRequest);
    } catch (error) {
      return response.error(res, error);
    }
  },
  acceptedorderfordriver: async (req, res) => {
    try {
      const product = await ProductRequest.find({
        driver_id: req.user.id,
        status: { $ne: "Completed" },
        isLocalDelivery: true,
      })
        .sort({ createdAt: -1 })
        .populate("user", "-password")
        .lean();
      let newupdatedRequest = decryptPopulatedData(product, "user");
      return response.ok(res, newupdatedRequest);
    } catch (error) {
      return response.error(res, error);
    }
  },

  getOrderHistoryByAdmin: async (req, res) => {
    try {
      const { page = 1, limit = 20 } = req.query;
      const product = await ProductRequest.find({
        status: { $in: ["Delivered", "Completed"] },
      })
        .collation({ locale: "en", strength: 2 })
        .populate("user", "-password -varients")
        .populate("productDetail.product")
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean();
      let newupdatedRequest = decryptPopulatedData(product, "user");
      return res.status(200).json({
        status: true,
        data: newupdatedRequest,
      });
    } catch (error) {
      return response.error(res, error);
    }
  },

  getPendingOrdersByAdmin: async (req, res) => {
    try {
      const { page = 1, limit = 20, filter } = req.query;
      let cond = {};

      const parsedFilter = filter ? JSON.parse(filter) : null;
      // // // console.log("Parsed Filter", parsedFilter);

      if (parsedFilter) {
        if (parsedFilter.orderType) {
          switch (parsedFilter.orderType) {
            case "isOrderPickup":
              cond.isOrderPickup = true;
              break;
            case "isDriveUp":
              cond.isDriveUp = true;
              break;
            case "isLocalDelivery":
              cond.isLocalDelivery = true;
              break;
            case "isShipmentDelivery":
              cond.isShipmentDelivery = true;
              break;
          }
        }

        if (
          parsedFilter.date &&
          parsedFilter.startDate &&
          parsedFilter.endDate
        ) {
          const dateRange = {
            $gte: new Date(parsedFilter.startDate),
            $lte: new Date(parsedFilter.endDate),
          };

          if (parsedFilter.date === "dateOfDelivery") {
            cond.dateOfDelivery = dateRange;
          } else if (parsedFilter.date === "createdAt") {
            cond.createdAt = dateRange;
          }
        }
      }

      const product = await ProductRequest.find({
        status: { $nin: ["Delivered", "completed"] },
        ...cond,
      })
        .collation({ locale: "en", strength: 2 })
        .populate("user", "-password -varients")
        .populate("productDetail.product")
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean();
      let newupdatedRequest = decryptPopulatedData(product, "user");
      return res.status(200).json({
        status: true,
        data: newupdatedRequest,
      });
    } catch (error) {
      return response.error(res, error);
    }
  },

  createPdf: async (req, res) => {
    try {
      const { orderId, lang } = req.body;

      if (!orderId) {
        return res.status(400).json({ message: "Order ID is required" });
      }

      const order = await ProductRequest.findById(orderId)
        .populate("user", "-password")
        .populate("productDetail.product")
        .lean();

      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      let user = decryptObject(order.user);
      order.user = user;

      const PDFDocument = require("pdfkit");
      const doc = new PDFDocument({ margin: 50, size: "A4" });

      // Set up buffer collection
      const buffers = [];
      doc.on("data", buffers.push.bind(buffers));

      const pdfPromise = new Promise((resolve) => {
        doc.on("end", () => {
          const pdfBuffer = Buffer.concat(buffers);
          resolve(pdfBuffer);
        });
      });

      // Helper function to draw rounded rectangles
      const drawRoundedRect = (x, y, width, height, radius, color) => {
        doc.roundedRect(x, y, width, height, radius).fill(color);
      };

      // Header with modern design
      drawRoundedRect(0, 0, doc.page.width, 100, 0, "#f38529");

      doc
        .fontSize(28)
        .fillColor("white")
        .font("Helvetica-Bold")
        .text("BHH FOOD", 50, 35, { align: "left" });

      doc
        .fontSize(12)
        .fillColor("white")
        .font("Helvetica")
        .text("Shop Everyday Essentials at BHH FOOD", 50, 65);

      doc
        .fontSize(24)
        .fillColor("white")
        .font("Helvetica-Bold")
        .text("INVOICE", 400, 35, { align: "right" });

      // Invoice details box
      drawRoundedRect(370, 75, 180, 90, 5, "#f8f9fa");
      doc
        .strokeColor("#dee2e6")
        .lineWidth(1)
        .roundedRect(370, 75, 180, 90, 5)
        .stroke();

      doc
        .fontSize(10)
        .fillColor("#2c3e50")
        .font("Helvetica-Bold")
        .text("Invoice #:", 385, 85)
        .text("Date:", 385, 100)
        .text("Time:", 385, 115)
        .text("Status:", 385, 130)
        .text("Order Type:", 385, 145);

      doc
        .font("Helvetica")
        .text(order.orderId, 440, 85)
        .text(order.orderDate, 450, 100)
        .text(order.orderTime, 450, 115)
        .text(order.status, 450, 130);

      let orderType = "Store Pickup";
      if (order.isLocalDelivery) orderType = "Local Delivery";
      if (order.isShipmentDelivery) orderType = "Shipment Delivery";
      if (order.isDriveUp) orderType = "Curbside Pickup";

      doc.text(orderType, 450, 145);

      // Customer information section
      doc
        .fontSize(14)
        .fillColor("#f38529")
        .font("Helvetica-Bold")
        .text("BILL TO:", 50, 180);

      doc
        .fontSize(12)
        .fillColor("#2c3e50")
        .font("Helvetica")
        .text(
          order.user.username + " " + (order?.user?.lastname || ""),
          50,
          200
        )
        .text(order.user.email, 50, 215)
        .text(order.user.number || "N/A", 50, 230);

      // Delivery information
      if (order.Local_address) {
        doc
          .fontSize(14)
          .fillColor("#f38529")
          .font("Helvetica-Bold")
          .text("DELIVER TO:", 300, 180);

        doc
          .fontSize(12)
          .fillColor("#2c3e50")
          .font("Helvetica")
          .text(order.Local_address.address || "N/A", 300, 200)
          .text(
            `${order.Local_address.city || ""} ${order.Local_address.state || ""
            }`,
            300,
            215
          )
          .text(order.Local_address.zipCode || "", 300, 230);
      }

      // Delivery date if available
      if (order.dateOfDelivery) {
        const deliveryDate = new Date(
          order.dateOfDelivery
        ).toLocaleDateString();
        doc
          .fontSize(12)
          .fillColor("#2c3e50")
          .font("Helvetica-Bold")
          .text(`Pickup/Delivery Date: ${deliveryDate}`, 50, 260);
      }

      // Table header with modern styling
      const tableTop = 300;
      drawRoundedRect(50, tableTop, 500, 25, 3, "#f38529");

      doc
        .fontSize(12)
        .fillColor("white")
        .font("Helvetica-Bold")
        .text("Item", 60, tableTop + 8)
        .text("Qty", 300, tableTop + 8)
        .text("Price", 370, tableTop + 8)
        .text("Total", 470, tableTop + 8);

      // Table rows
      let currentY = tableTop + 25;
      let subtotal = 0;

      // Register font only once (outside loop)
      doc.registerFont("NotoSans", "src/app/helper/Fonts/NotoSans-Regular.ttf");

      order.productDetail.forEach((item, index) => {
        const itemTotal = parseFloat(item.price) * parseInt(item.qty);
        subtotal += itemTotal;

        const productName =
          lang === "en" ? item.product?.name : item.product?.vietnamiesName;
        const maxWidth = 220;
        const fontSize = 10;

        // Calculate height of product name
        doc.font("NotoSans").fontSize(fontSize);
        const textHeight = doc.heightOfString(productName, { width: maxWidth });
        const rowHeight = Math.max(30, textHeight + 16); // base 30px or text height + padding

        // Alternate row colors
        if (index % 2 === 0) {
          drawRoundedRect(50, currentY, 500, rowHeight, 0, "#f8f9fa");
        }

        // Draw text
        doc
          .fillColor("#2c3e50")
          .text(productName, 60, currentY + 8, { width: maxWidth })
          .text(item.qty.toString(), 300, currentY + 8)
          .text(`$${parseFloat(item.price).toFixed(2)}`, 370, currentY + 8)
          .text(`$${itemTotal.toFixed(2)}`, 470, currentY + 8);

        // Bottom border line
        doc
          .strokeColor("#dee2e6")
          .lineWidth(1)
          .moveTo(50, currentY + rowHeight)
          .lineTo(550, currentY + rowHeight)
          .stroke();

        currentY += rowHeight; // ✅ Move down according to actual height
      });

      // Summary section
      const totalsY = currentY + 20;

      // Draw summary background
      drawRoundedRect(350, totalsY - 10, 200, 150, 5, "#f8f9fa");
      doc
        .strokeColor("#dee2e6")
        .lineWidth(1)
        .roundedRect(350, totalsY - 10, 200, 150, 5)
        .stroke();

      doc
        .fontSize(12)
        .fillColor("#2c3e50")
        .font("Helvetica")
        .text("Subtotal:", 370, totalsY)
        .text(`$${subtotal.toFixed(2)}`, 470, totalsY);

      const tax = order.totalTax || 0;
      doc
        .text("Total Tax:", 370, totalsY + 20)
        .text(`$${parseFloat(tax).toFixed(2)}`, 470, totalsY + 20);

      const tip = order.Deliverytip || 0;
      doc
        .text("Delivery Tip:", 370, totalsY + 40)
        .text(`$${parseFloat(tip).toFixed(2)}`, 470, totalsY + 40);

      const deliveryFee = order.deliveryfee || 0;
      doc
        .text("Delivery Fee:", 370, totalsY + 60)
        .text(`$${parseFloat(deliveryFee).toFixed(2)}`, 470, totalsY + 60);

      const discount = order.discount || 0;

      doc
        .text("Discount:", 370, totalsY + 80)
        .text(`-$${parseFloat(discount).toFixed(2)}`, 470, totalsY + 80);

      const totalAmount =
        order.totalAmount !== undefined && order.totalAmount !== null
          ? parseFloat(order.totalAmount)
          : Number(subtotal) +
          Number(tax) +
          Number(deliveryFee) +
          Number(tip) -
          Number(discount);

      doc
        .fontSize(14)
        .fillColor("#f38529")
        .font("Helvetica-Bold")
        .text("Total:", 370, totalsY + 110)
        .text(`$${parseFloat(totalAmount).toFixed(2)}`, 470, totalsY + 110);

      // Footer
      doc
        .fontSize(10)
        .fillColor("#6c757d")
        .font("Helvetica")
        .text("Thank you for shopping with BHH FOOD!", 50, doc.page.height - 100, {
          align: "center",
          width: 500,
        })
        .text(
          "For support, contact us at contact@bhhfood.com",
          50,
          doc.page.height - 85,
          {
            align: "center",
            width: 500,
          }
        )
        .text(
          "Visit us at: www.bhhfood.com",
          50,
          doc.page.height - 70,
          {
            align: "center",
            width: 500,
          }
        );

      doc.end();

      const pdfBuffer = await pdfPromise;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=bhhfood-invoice-${orderId}.pdf`
      );

      res.send(pdfBuffer);
    } catch (error) {
      // // // console.error("PDF Generation Error:", error);
      return res
        .status(500)
        .json({ message: "Error generating PDF", error: error.message });
    }
  },

  assignDriver: async (req, res) => {
    try {
      const { orderId, driverId } = req.body;

      if (!orderId || !driverId) {
        return res
          .status(400)
          .json({ message: "Order ID and Driver ID are required" });
      }

      const order = await ProductRequest.findById(orderId);

      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      order.driver_id = driverId;
      order.status = "Driverassigned";

      const updatedOrder = await order.save();

      return response.ok(res, updatedOrder);
    } catch (error) {
      // // // console.error("Error assigning driver:", error);
      return response.error(res, error);
    }
  },

  markOrderAsDelivered: async (req, res) => {
    try {
      const { orderId } = req.body;

      if (!orderId) {
        return res.status(400).json({ message: "Order ID is required" });
      }

      const order = await ProductRequest.findById(orderId);

      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      order.status = "Completed";
      order.deliveryDate = new Date();

      const updatedOrder = await order.save();

      return response.ok(res, updatedOrder);
    } catch (error) {
      // // // console.error("Error marking order as completed:", error);
      return response.error(res, error);
    }
  },

  submitProofOfDelivery: async (req, res) => {
    try {
      const { orderId, proofOfDelivery } = req.body;

      if (!orderId || !proofOfDelivery) {
        return res
          .status(400)
          .json({ message: "Order ID and proof of delivery are required" });
      }

      const order = await ProductRequest.findById(orderId).populate(
        "user",
        "user_email _id"
      );

      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      order.proofOfDelivery = proofOfDelivery;
      order.status = "Completed";
      order.deliveredAt = new Date();
      let userEmail = decryptValue(order.user.user_email);
      // const updatedOrder = await order.save();

      await mailNotification.orderDeliveredForLocalDelievry({
        email: userEmail,
        orderId: order.orderId,
        proofOfDelivery: proofOfDelivery,
      });

      await notify(
        order.user._id,
        "Order Delivered",
        `Your order with ID ${order.orderId} has been delivered successfully.`,
        order.orderId
      );
      const updatedRequest = await ProductRequest.findByIdAndUpdate(
        order._id,
        order
      )
        .populate("user", "user_email _id")
        .lean();

      let user = decryptObject(updatedRequest.user);

      return response.ok(res, { ...updatedRequest, user: { ...user } });
    } catch (error) {
      // // // console.error("Error submitting proof of delivery:", error);
      return response.error(res, error);
    }
  },

  markOrderAsPreparing: async (req, res) => {
    try {
      const { orderId } = req.body;

      if (!orderId) {
        return res.status(400).json({ message: "Order ID is required" });
      }

      const order = await ProductRequest.findById(orderId).populate(
        "user",
        "user_email _id"
      );

      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      order.status = "Preparing";

      // const updatedOrder = await order.save();
      let userEmail = decryptValue(order.user.user_email);
      await mailNotification.orderPreparing({
        email: userEmail,
        orderId: order.orderId,
      });

      await notify(
        order.user._id,
        "Order Preparing",
        `Your order with ID ${order.orderId} is now being prepared.`,
        order.orderId
      );
      const updatedRequest = await ProductRequest.findByIdAndUpdate(
        order._id,
        order
      )
        .populate("user", "user_email _id")
        .lean();

      let user = decryptObject(updatedRequest.user);

      return response.ok(res, { ...updatedRequest, user: { ...user } });
    } catch (error) {
      // // // console.error("Error marking order as preparing:", error);
      return response.error(res, error);
    }
  },
  acceptorderdriver: async (req, res) => {
    try {
      const product = await ProductRequest.findById(req.params.id);
      if (product.driver) {
        return response.badReq(res, { message: "Order already accepted" });
      }
      product.driver_id = req.user.id;
      // product.status='Driveraccepted'
      product.save();
      return response.ok(res, product);
    } catch (error) {
      return response.error(res, error);
    }
  },

  dashboarddetails: async (req, res) => {
    try {
      const allTransactions = await ProductRequest.find({
        $or: [{ paymentStatus: "Succeeded" }, { status: "Completed" }],
      });

      const totalAmount = allTransactions.reduce(
        (sum, txn) => sum + (Number(txn.total) || 0),
        0
      );

      const allCategories = await Category.countDocuments();
      const totalUsers = await User.countDocuments({ type: "USER" });
      const totalFeedbacks = await ContactUs.countDocuments();

      const details = {
        totalTransactionAmount: totalAmount.toFixed(2),
        totalCategories: allCategories,
        totalUsers: totalUsers,
        totalFeedbacks: totalFeedbacks,
      };

      return response.ok(res, details);
    } catch (error) {
      return response.error(res, error);
    }
  },

  getBulkBuyProduct: async (req, res) => {
    try {
      let products = await Product.aggregate([
        {
          $lookup: {
            from: "categories", // Category collection ka naam
            localField: "category",
            foreignField: "_id",
            as: "category",
          },
        },
        { $unwind: "$category" },
        { $match: { "category.name": "Bulk Buy" } },
        { $sort: { createdAt: -1 } },
      ]);

      // Filter product data based on user authentication and document verification
      const filteredProducts = await filterProductData(products, req);

      return res.status(200).json({
        status: true,
        data: filteredProducts,
      });
    } catch (error) {
      return response.error(res, error);
    }
  },

  getMonthlySales: async (req, res) => {
    const year = parseInt(req.query.year);

    if (!year || isNaN(year)) {
      return res.status(400).json({ success: false, message: "Invalid year" });
    }

    try {
      const start = new Date(`${year}-01-01`);
      const end = new Date(`${year + 1}-01-01`);

      const sales = await ProductRequest.aggregate([
        {
          $match: {
            createdAt: { $gte: start, $lt: end },

            // ✅ Only successful / completed orders
            $or: [{ paymentStatus: "Succeeded" }, { status: "Completed" }],
          },
        },
        {
          $group: {
            _id: { $month: "$createdAt" },
            totalSales: {
              $sum: { $toDouble: "$total" },
            },
          },
        },
        {
          $project: {
            month: "$_id",
            totalSales: 1,
            _id: 0,
          },
        },
        {
          $sort: { month: 1 },
        },
      ]);

      // ✅ Ensure all 12 months exist
      const fullData = Array.from({ length: 12 }, (_, i) => {
        const month = i + 1;
        const found = sales.find((s) => s.month === month);

        return {
          name: new Date(0, i).toLocaleString("default", { month: "short" }),
          monthly: found ? found.totalSales : 0,
        };
      });

      return response.ok(res, fullData);
    } catch (error) {
      return response.error(res, error);
    }
  },

  updateProductImages: async (req, res) => {
    try {
      let product = await Product.find({}, "name varients.image");

      const result = product
        .map((item) => ({
          _id: item._id,
          name: item.name,
          varients: item.varients
            .map((variant) => ({
              image: variant.image.filter((url) => !/\.[^/.]+$/.test(url)), // keep only URLs without extension
            }))
            .filter((variant) => variant.image.length > 0), // remove empty image arrays
        }))
        .filter((item) => item.varients.length > 0);
      updateImageExtension("1752601534389-blob");
      return response.ok(res, result);
    } catch (error) {
      return response.error(res, error);
    }
  },
  downloadProductsExcel: async (req, res) => {
    try {
      const products = await Product.find().lean();

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Products");

      // Define headers
      worksheet.columns = [
        { header: "Name", key: "name", width: 80 },
        { header: "Category Name", key: "categoryName", width: 25 },
        { header: "Price Slot Values", key: "values", width: 20 },
        { header: "Unit", key: "unit", width: 15 },
        { header: "Our Price", key: "our_price", width: 15 },
      ];

      // Add rows
      products.forEach((p) => {
        const priceSlots = p.price_slot || [];
        const values = priceSlots.map((s) => s.value ?? "").join(", ");
        const units = priceSlots.map((s) => s.unit ?? "").join(", ");
        const ourPrices = priceSlots.map((s) => s.our_price ?? "").join(", ");

        worksheet.addRow({
          name: p.name,
          categoryName: p.categoryName,
          values,
          unit: units,
          our_price: ourPrices,
        });
      });

      const header = worksheet.getRow(1);
      header.font = { bold: true, color: { argb: "FFFFFFFF" } };
      header.alignment = { horizontal: "center", vertical: "middle" };
      header.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFEA580C" }, // orange-500
      };

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
          row.alignment = { vertical: "middle" };
        }
        row.border = {
          top: { style: "thin", color: { argb: "FFD6D6D6" } },
          left: { style: "thin", color: { argb: "FFD6D6D6" } },
          bottom: { style: "thin", color: { argb: "FFD6D6D6" } },
          right: { style: "thin", color: { argb: "FFD6D6D6" } },
        };
      });

      // Send file
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=products.xlsx"
      );

      await workbook.xlsx.write(res);
      res.end();
    } catch (err) {
      // // // console.error("Excel export error:", err);
      res.status(500).json({ message: "Failed to generate Excel file" });
    }
  },

  setProductPosition: async (req, res) => {
    try {
      const { productId, position } = req.body;

      if (!productId || position == null) {
        return res.status(400).json({
          status: false,
          message: "productId and position are required",
        });
      }

      const existingProduct = await Product.findOne({ position });

      if (existingProduct && existingProduct._id.toString() !== productId) {
        return res.status(400).json({
          status: false,
          message: `Position ${position} is already assigned to another product. Please use another position.`,
        });
      }

      const updatedProduct = await Product.findByIdAndUpdate(
        productId,
        { position },
        { new: true }
      );

      if (!updatedProduct) {
        return res.status(404).json({
          status: false,
          message: "Product not found",
        });
      }

      return res.status(200).json({
        status: true,
        message: "Product position updated successfully",
        data: updatedProduct,
      });
    } catch (error) {
      return res.status(500).json({
        status: false,
        message: error.message,
      });
    }
  },

  findDuplicateItems: async (req, res) => {
    try {
      // const product = await Product.aggregate([
      //   {
      //     $group: {
      //       _id: "$name",
      //       count: { $sum: 1 },

      //       // ❌ NO slug (missing, null, empty)
      //       ids: {
      //         $push: {
      //           $cond: [
      //             {
      //               $or: [
      //                 { $eq: [{ $type: "$tax_code" }, "missing"] },
      //                 { $eq: ["$tax_code", null] },
      //                 { $eq: ["$tax_code", ""] }
      //               ]
      //             },
      //             "$_id",
      //             "$$REMOVE"
      //           ]
      //         }
      //       },

      //       // ✅ HAS slug
      //       products: {
      //         $push: {
      //           $cond: [
      //             {
      //               $and: [
      //                 { $ne: [{ $type: "$slug" }, "missing"] },
      //                 { $ne: ["$slug", null] },
      //                 { $ne: ["$slug", ""] }
      //               ]
      //             },
      //             "$$ROOT",
      //             "$$REMOVE"
      //           ]
      //         }
      //       }
      //     }
      //   },

      //   // only duplicates
      //   {
      //     $match: {
      //       count: { $gt: 1 },
      //       "products.0": { $exists: true } // ensure slug exists
      //     }
      //   }
      // ]);

      const product = await Product.aggregate([
        {
          $match: {
            $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }],
          },
        },
        {
          $group: {
            _id: "$name",
            count: { $sum: 1 },
          },
        },
        {
          $match: {
            count: { $gt: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            name: "$_id",
            count: 1,
          },
        },
      ]);

      // const product = await Product.find({
      //   $or: [
      //     { slug: { $exists: false } },
      //     { slug: null },
      //     { slug: "" }
      //   ]
      // });
      return res.status(200).json({
        status: true,
        message: "Product position updated successfully",
        data: product,
        count: product.length,
      });
    } catch (error) {
      return res.status(500).json({
        status: false,
        message: error.message,
      });
    }
  },
};
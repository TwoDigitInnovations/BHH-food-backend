"use strict";
const userHelper = require("./../helper/user");
const response = require("./../responses");
const passport = require("passport");
const jwtService = require("./../services/jwtService");
const mailNotification = require("./../services/mailNotification");
const mongoose = require("mongoose");
const Device = mongoose.model("Device");
const User = mongoose.model("User");
const Review = mongoose.model("Review");
const Store = mongoose.model("Store");
const Verification = mongoose.model("Verification");
const ProductRequest = mongoose.model("ProductRequest");
const { v4: uuidv4 } = require("uuid");
const generateUniqueId = require("generate-unique-id");
const { notify } = require("../services/notification");
const ExcelJS = require("exceljs");
const {
  sendMailWithSubjectViaSendgrid,
  sendMailWithSTemplateViaSendgrid,
} = require("../services/sendgrid");
const { logmate } = require("../../middlewares/logmate");
const { encryptData, decryptArray, decryptValue, decryptPopulatedData, decryptObject, hashValue, decryptArraywithoutKey } = require("../../middlewares/codeDecript");

module.exports = {
  createNewUser: async (req, res) => {
    try {
      const users = await User.find();
      let datas = []
      // await Promise.all(

      //   // users.map(async f => {
      //   //   let u = {}
      //   //   if (f.email) {
      //   //     u.email = encryptData(f.email);
      //   //     // u.Oemail = f.email;
      //   //   }
      //   //   if (f.username) {
      //   //     u.username = encryptData(f.username)
      //   //     // u.Ousername = f.username;
      //   //   }
      //   //   if (f.lastname) {
      //   //     u.lastname = encryptData(f.lastname)
      //   //     // u.Olastname = f.lastname;
      //   //   }
      //   //   if (f.number) {
      //   //     u.number = encryptData(f.number)
      //   //     // u.Onumber = f.number;
      //   //   }

      //   //   // if (u) {
      //   //   //   await User.findByIdAndUpdate(f._id, u);
      //   //   // }
      //   //   datas.push(u)
      //   // })
      // )
      // const d = await decryptArray(datas)
      return res.status(201).json({
        success: true,
        message: 'Data Saved successfully!',
        data: { lenght: users.length, users }
      })

    } catch (e) {
      return res.status(500).json({
        success: false,
        message: e.message
      });
    }
  },

  // login controller
  login: (req, res) => {
    // // console.log("request came here");
    passport.authenticate("local", async (err, user, info) => {
      if (err) {
        return response.error(res, err);
      }
      if (!user) {
        return response.unAuthorize(res, info);
      }
      let token = await new jwtService().createJwtToken({
        id: user._id,
        type: user.type,
        tokenVersion: new Date(),
      });
      await user.save();
      const userdata = await User.findById(user._id, '-password -email -username -lastname -number').lean();
      let newupdatedRequest = decryptObject(userdata);
      if (user.type === "SELLER") {
        let store = await Store.findOne({ userid: user._id });
        newupdatedRequest.store = store;
      }
      newupdatedRequest.token = token
      return response.ok(res, { ...newupdatedRequest });
    })(req, res);
  },

  loginwithOtp: (req, res) => {
    // // console.log("request came here");
    passport.authenticate("local", async (err, user, info) => {
      if (err) {
        return response.error(res, err);
      }
      if (!user) {
        return response.unAuthorize(res, info);
      }

      await logmate(req, res, user);
      if (user.type === 'USER') {
        return response.conflict(res, { message: "Invalid account" });
      }
      let ran_otp = Math.floor(1000 + Math.random() * 9000);

      let email = decryptValue(user.user_email)
      // console.log(email, ran_otp)
      await mailNotification.sendOTPmail({
        code: ran_otp,
        email: email,
      });

      let ver = new Verification({
        user: user._id,
        otp: ran_otp,
        expiration_at: userHelper.getDatewithAddedMinutes(5),
      });
      await ver.save();
      // }
      let token = await userHelper.encode(ver._id);
      return response.ok(res, { message: "OTP sent.", token });
    })(req, res);
  },

  verifyOTPForLogin: async (req, res) => {
    try {
      const otp = req.body.otp;
      const token = req.body.token;
      if (!(otp && token)) {
        return response.badReq(res, { message: "otp and token required." });
      }

      let verId = await userHelper.decode(token);

      let ver = await Verification.findById(verId);
      let user = await userHelper.find({ _id: ver.user })
      await logmate(req, res, user);
      if (
        otp == ver.otp &&
        !ver.verified &&
        new Date().getTime() < new Date(ver.expiration_at).getTime()
      ) {
        ver.verified = true;
        await ver.save();
        let token = await new jwtService().createJwtToken({
          id: user._id,
          type: user.type,
          tokenVersion: new Date(),
        });

        // let data = {
        //   token,
        //   ...user._doc,
        // };
        const userdata = await User.findById(user._id, '-password').lean();
        let newupdatedRequest = decryptObject(userdata);
        return response.ok(res, { ...newupdatedRequest, token });
        // return response.ok(res, { message: "OTP verified", token });
      } else {
        return response.notFound(res, { message: "Invalid OTP" });
      }
    } catch (error) {
      return response.error(res, error);
    }
  },

  signUp: async (req, res) => {
    try {
      const payload = req.body;
      const mail = await hashValue(req.body.email);
      if (!mail) {
        return response.badReq(res, { message: "Email required." });
      }

      // Check if document is uploaded
      if (!req.files || !req.files.document) {
        return response.badReq(res, { message: "Document verification is required." });
      }

      let user2 = await User.findOne({
        user_email_hash: mail,
      });
      const user = await User.findOne({ number: payload.number });
      if (user) {
        return res.status(404).json({
          success: false,
          message: "Phone number already exists.",
        });
      }
      if (user2) {
        return res.status(404).json({
          success: false,
          message: "Email Id already exists.",
        });
      } else {
        let name = payload?.username;
        const id3 = generateUniqueId({
          includeSymbols: ["@", "#"],
          length: 8,
        });
        let n = name.replaceAll(" ", "");
        var output =
          n.substring(0, 2) + id3 + n.substring(n.length - 2, n.length);
        let d = output.toUpperCase();
        let userEmail = await encryptData(payload?.email);
        let userPhone = await encryptData(payload?.number);
        
        // Handle document file (required)
        const documentUrl = req.files.document ? `${process.env.ASSET_ROOT}/${req.files.document[0].key}` : null;
        const encryptedDocumentUrl = documentUrl ? await encryptData(documentUrl) : null;
        
        // Handle reseller permit file (optional)
        let resellerPermitUrl = null;
        let encryptedResellerPermitUrl = null;
        if (req.files && req.files.resellerPermit) {
          resellerPermitUrl = `${process.env.ASSET_ROOT}/${req.files.resellerPermit[0].key}`;
          encryptedResellerPermitUrl = await encryptData(resellerPermitUrl);
        }
        
        let user = new User({
          // username: payload?.username,
          email: userEmail,
          number: userPhone,
          type: payload?.type,
          // lastname: payload?.lastname,
          user_email_hash: mail,
          user_email: userEmail,
          user_first_name: await encryptData(payload?.username),
          user_last_name: await encryptData(payload?.lastname),
          user_phone: userPhone,
          document: encryptedDocumentUrl,
          documentVerified: false,
          businessType: payload?.businessType,
          legalBusinessName: payload?.legalBusinessName ? await encryptData(payload?.legalBusinessName) : null,
          resellerPermit: encryptedResellerPermitUrl,
          paymentMethod: payload?.paymentMethod === 'true' || payload?.paymentMethod === true,
          termsAgreement: payload?.termsAgreement === 'true' || payload?.termsAgreement === true
        });

        if (payload?.type === "DRIVER") {
          user.status = "Pending";
        }

        user.password = user.encryptPassword(req.body.password);
        await user.save();

        await mailNotification.welcomeMail({
          username: payload?.username,
          email: payload?.email,
          lastname: payload?.lastname,
        });
        const updatedRequest = await User.findById(user._id).lean();
        let newupdatedRequest = decryptObject(updatedRequest);
        res.status(200).json({ success: true, data: newupdatedRequest });
      }
    } catch (error) {
      return response.error(res, error);
    }
  },

  changePasswordProfile: async (req, res) => {
    try {
      let user = await User.findById(req.user.id);
      if (!user) {
        return response.notFound(res, { message: "User doesn't exists." });
      }
      user.password = user.encryptPassword(req.body.password);
      await user.save();
      return response.ok(res, { message: "Password changed." });
    } catch (error) {
      return response.error(res, error);
    }
  },

  me: async (req, res) => {
    try {
      let user = userHelper.find({ _id: req.user.id }).lean();
      let updatedData = decryptObject(user)
      return response.ok(res, updatedData);
    } catch (error) {
      return response.error(res, error);
    }
  },
  updateUser: async (req, res) => {
    try {
      let payload = req.body;
      delete payload.password;
      if (payload.email) {
        payload.user_email_hash = hashValue(payload.email)
        let email = encryptData(payload.email)
        payload.email = email;
        payload.user_email = email;
      }
      if (payload.number) {
        payload.user_phone = encryptData(payload.number)
      }
      if (payload.username) {
        payload.user_first_name = encryptData(payload.username)
      }
      if (payload.lastname) {
        payload.user_last_name = encryptData(payload.lastname)
      }
      await User.updateOne({ _id: req.user.id }, { $set: payload });
      return response.ok(res, { message: "Profile Updated." });
    } catch (error) {
      return response.error(res, error);
    }
  },
  sendOTP: async (req, res) => {
    try {
      const email = hashValue(req.body.email);
      const user = await User.findOne({ email });

      if (!user) {
        return response.badReq(res, { message: "Email does not exist." });
      }

      let ran_otp = Math.floor(1000 + Math.random() * 9000);

      await mailNotification.sendOTPmail({
        code: ran_otp,
        email: email,
      });

      let ver = new Verification({
        user: user._id,
        otp: ran_otp,
        expiration_at: userHelper.getDatewithAddedMinutes(5),
      });
      await ver.save();
      // }
      let token = await userHelper.encode(ver._id);

      return response.ok(res, { message: "OTP sent.", token });
    } catch (error) {
      return response.error(res, error);
    }
  },

  verifyOTP: async (req, res) => {
    try {
      const otp = req.body.otp;
      const token = req.body.token;
      if (!(otp && token)) {
        return response.badReq(res, { message: "otp and token required." });
      }
      let verId = await userHelper.decode(token);
      let ver = await Verification.findById(verId);
      if (
        otp == ver.otp &&
        !ver.verified &&
        new Date().getTime() < new Date(ver.expiration_at).getTime()
      ) {
        let token = await userHelper.encode(
          ver._id + ":" + userHelper.getDatewithAddedMinutes(5).getTime()
        );
        ver.verified = true;
        await ver.save();
        return response.ok(res, { message: "OTP verified", token });
      } else {
        return response.notFound(res, { message: "Invalid OTP" });
      }
    } catch (error) {
      return response.error(res, error);
    }
  },

  changePassword: async (req, res) => {
    try {
      const token = req.body.token;
      const password = req.body.password;
      const data = await userHelper.decode(token);
      const [verID, date] = data.split(":");
      if (new Date().getTime() > new Date(date).getTime()) {
        return response.forbidden(res, { message: "Session expired." });
      }
      let otp = await Verification.findById(verID);
      if (!otp.verified) {
        return response.forbidden(res, { message: "unAuthorize" });
      }
      let user = await User.findById(otp.user);
      if (!user) {
        return response.forbidden(res, { message: "unAuthorize" });
      }
      await Verification.findByIdAndDelete(verID);
      user.password = user.encryptPassword(password);
      await user.save();
      let email = decryptValue(user.user_email)
      mailNotification.passwordChange({ email });
      return response.ok(res, { message: "Password changed! Login now." });
    } catch (error) {
      return response.error(res, error);
    }
  },

  getUserList: async (req, res) => {
    try {
      const cond = { type: req.query.type };

      if (req.query.searchTerm && req.query.searchTerm.trim() !== "") {
        const searchTerm = hashValue(req.query.searchTerm.trim());
        cond.user_email_hash = searchTerm;
        // cond.$or = [
        //   { username: { $regex: searchTerm, $options: "i" } },
        //   { lastname: { $regex: searchTerm, $options: "i" } },
        //   { email: { $regex: searchTerm, $options: "i" } },
        // ];
      }
      const page = parseInt(req.query.page);
      const limit = parseInt(req.query.limit);

      let users;
      let totalItems;
      let pagination = null;

      if (!page || !limit) {
        users = await User.find(cond).sort({ createdAt: -1 }).lean();
        totalItems = users.length;
      } else {
        const skip = (page - 1) * limit;
        totalItems = await User.countDocuments(cond);
        const totalPages = Math.ceil(totalItems / limit);

        users = await User.find(cond)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean();

        pagination = {
          totalItems,
          totalPages,
          currentPage: page,
          itemsPerPage: limit,
        };
      }
      // console.log(users)
      const data = decryptArraywithoutKey(users);
      // console.log(data)
      return res.status(200).json({
        status: true,
        data,
        pagination,
      });
    } catch (error) {
      return response.error(res, error);
    }
  },

  getSellerList: async (req, res) => {
    try {
      // let user = await User.find({ type: req.params.type });
      let user = await User.aggregate([
        {
          $match: { type: "SELLER" },
        },
        {
          $lookup: {
            from: "stores",
            localField: "_id",
            foreignField: "userid",
            as: "store",
          },
        },
        {
          $unwind: {
            path: "$store",
            preserveNullAndEmptyArrays: true,
          },
        },
      ]);
      const data = decryptArraywithoutKey(user);
      return response.ok(res, data);
    } catch (error) {
      return response.error(res, error);
    }
  },

  getDriverList: async (req, res) => {
    try {
      let page = parseInt(req.query.page) || 1;
      let limit = parseInt(req.query.limit) || 10;
      let skip = (page - 1) * limit;

      const [drivers, total] = await Promise.all([
        User.find({
          type: "DRIVER",
          status: { $in: ["Pending", "Verified", "Suspended"] },
        })
          .skip(skip)
          .limit(limit)
          .lean(),

        User.countDocuments({
          type: "DRIVER",
          status: { $in: ["Pending", "Verified", "Suspended"] },
        }),
      ]);
      const data = decryptArraywithoutKey(drivers);
      return response.ok(res, {
        drivers: data,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      return response.error(res, error);
    }
  },

  getVerifiedDriverList: async (req, res) => {
    try {
      const drivers = await User.find({
        type: "DRIVER",
        status: { $in: ["Verified"] },
      }).lean();
      let user = decryptArraywithoutKey(drivers);
      return response.ok(res, user);
    } catch (error) {
      return response.error(res, error);
    }
  },

  updateStatus: async (req, res) => {
    try {
      const payload = req?.body || {};
      let driver = await User.findByIdAndUpdate(payload?.id, payload, {
        new: true,
        upsert: true,
      }).lean();
      let user = decryptObject(driver)
      return response.ok(res, user);
    } catch (error) {
      return response.error(res, error);
    }
  },

  verifyDocument: async (req, res) => {
    try {
      const { userId, verified } = req.body;
      
      if (!userId) {
        return response.badReq(res, { message: "User ID is required." });
      }

      const user = await User.findByIdAndUpdate(
        userId,
        { documentVerified: verified },
        { new: true }
      ).lean();

      if (!user) {
        return response.notFound(res, { message: "User not found." });
      }

      let decryptedUser = decryptObject(user);
      
      // Send notification email to user
      const email = decryptValue(user.user_email);
      const username = decryptValue(user.user_first_name);
      
      if (verified) {
        await mailNotification.documentVerified({
          email: email,
          username: username,
        });
      } else {
        await mailNotification.documentRejected({
          email: email,
          username: username,
        });
      }

      return response.ok(res, { 
        message: `Document ${verified ? 'verified' : 'rejected'} successfully.`,
        user: decryptedUser 
      });
    } catch (error) {
      return response.error(res, error);
    }
  },

  getPendingDocuments: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const filter = {
        document: { $exists: true, $ne: null },
        documentVerified: false,
        type: "USER"
      };

      const users = await User.find(filter)
        .select("-password")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const totalUsers = await User.countDocuments(filter);
      const totalPages = Math.ceil(totalUsers / limit);

      let decryptedUsers = decryptArraywithoutKey(users);

      // Decrypt document URLs for admin viewing and add index numbers
      decryptedUsers = decryptedUsers.map((user, index) => ({
        ...user,
        document: user.document ? decryptValue(user.document) : null,
        resellerPermit: user.resellerPermit ? decryptValue(user.resellerPermit) : null,
        indexNo: skip + index + 1
      }));

      return res.status(200).json({
        status: true,
        data: decryptedUsers,
        pagination: {
          totalItems: totalUsers,
          totalPages,
          currentPage: page,
          itemsPerPage: limit,
        },
      });
    } catch (error) {
      return response.error(res, error);
    }
  },

  getAllUsersWithDocuments: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const filter = {
        document: { $exists: true, $ne: null },
        type: "USER"
      };

      const users = await User.find(filter)
        .select("-password")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const totalUsers = await User.countDocuments(filter);
      const totalPages = Math.ceil(totalUsers / limit);

      let decryptedUsers = decryptArraywithoutKey(users);

      // Decrypt document URLs for admin viewing and add index numbers
      decryptedUsers = decryptedUsers.map((user, index) => ({
        ...user,
        document: user.document ? decryptValue(user.document) : null,
        resellerPermit: user.resellerPermit ? decryptValue(user.resellerPermit) : null,
        indexNo: skip + index + 1
      }));

      return res.status(200).json({
        status: true,
        data: decryptedUsers,
        pagination: {
          totalItems: totalUsers,
          totalPages,
          currentPage: page,
          itemsPerPage: limit,
        },
      });
    } catch (error) {
      return response.error(res, error);
    }
  },

  getProfile: async (req, res) => {
    try {
      // // console.log("ip address", req.clientIp);
      const u = await User.findById(req.user.id, "-password").lean();
      const deviceId = await Device.findOne({ user: u._id });
      const playerId = deviceId ? deviceId.player_id : null;
      // const data = {
      //   ...u._doc,
      //   playerId: playerId || null,
      // };
      // // console.log("User profile data:", playerId);
      let newData = decryptObject(u);
      // Decrypt document URL if exists
      if (newData.document) {
        newData.document = decryptValue(u.document);
      }
      
      return response.ok(res, { ...newData, playerId: playerId || null });
    } catch (error) {
      return response.error(res, error);
    }
  },
  updateProfile: async (req, res) => {
    const payload = req.body;
    const userId = req?.body?.userId || req.user.id;
    if (payload.email) {
      payload.user_email_hash = hashValue(payload.email)
      let email = encryptData(payload.email)
      payload.email = email;
      payload.user_email = email;
    }
    if (payload.number) {
      payload.user_phone = encryptData(payload.number)
    }
    if (payload.username) {
      payload.user_first_name = encryptData(payload.username)
    }
    if (payload.lastname) {
      payload.user_last_name = encryptData(payload.lastname)
    }
    try {
      const u = await User.findByIdAndUpdate(
        userId,
        { $set: payload },
        {
          new: true,
          upsert: true,
        }
      ).lean();
      let token = await new jwtService().createJwtToken({
        id: u._id,
        type: u.type,
        tokenVersion: new Date(),
      });
      let usr = decryptObject(u)
      const data = {
        token,
        ...usr,
      };
      delete data.password;
      // await Verification.findOneAndDelete({ phone: payload.phone });
      return response.ok(res, data);
      // }

      // }
    } catch (error) {
      return response.error(res, error);
    }
  },

  fileUpload: async (req, res) => {
    try {
      let key = req.file && req.file.key;
      return response.ok(res, {
        message: "File uploaded.",
        file: `${process.env.ASSET_ROOT}/${key}`,
      });
    } catch (error) {
      return response.error(res, error);
    }
  },

  giverate: async (req, res) => {
    // // console.log(req.body);
    try {
      let payload = req.body;

      const existingReview = await Review.findOne({
        product: payload.product,
        posted_by: req.user.id,
      });

      if (existingReview) {
        // Update existing review
        existingReview.description = payload.description;
        existingReview.images = payload.images || []; // ✅ Add this line
        await existingReview.save();
      } else {
        // Create new review
        payload.posted_by = req.user.id;
        payload.images = payload.images || []; // ✅ Ensure images field exists
        const newReview = new Review(payload);
        await newReview.save();
      }

      return response.ok(res, { message: "Successfully submitted review" });
    } catch (error) {
      return response.error(res, error);
    }
  },

  getReview: async (req, res) => {
    try {
      const cond = {};
      if (req.params.id) {
        cond.user = req.params.id;
      }

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const allreview = await Review.find(cond)
        .populate("product posted_by")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      let decrypterReview = decryptPopulatedData(allreview, 'posted_by')

      const totalReviews = await Review.countDocuments(cond);

      res.status(200).json({
        success: true,
        data: decrypterReview,
        page: page,
        totalReviews: totalReviews,
        totalPages: Math.ceil(totalReviews / limit), // Calculate total pages
      });
    } catch (e) {
      return res.status(500).json({
        success: false,
        message: e.message,
      });
    }
  },

  deleteReview: async (req, res) => {
    try {
      const ID = req.params.id;
      // // console.log(ID);
      const Re = await Review.findByIdAndDelete(ID);
      // // console.log(Re);

      if (!Re) {
        return response.notFound(res, { message: "Not Found" });
      }

      return response.ok(res, { message: "Review deleted successfully" });
    } catch (error) {
      // // console.log(error);
      return response.error(res, error);
    }
  },

  orderreadyNotification: async (req, res) => {
    try {
      const { id } = req.body;

      const product = await ProductRequest.findById(id).populate(
        "user",
        "user_email _id"
      );

      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Product not found",
        });
      }

      const email = decryptValue(product.user.user_email);
      product.isReady = true;
      // await product.save();

      if (product.isOrderPickup) {
        await mailNotification.orderReadyStore({
          email: email,
          id: product.orderId,
        });
        await notify(
          product.user._id,
          "Order Ready for Pickup",
          `Your order with ID ${product.orderId} is ready for pickup.`,
          product.orderId
        );
      } else if (product.isDriveUp) {
        await mailNotification.orderReady({
          email: email,
          id: product.orderId,
        });
        await notify(
          product.user._id,
          "Order Ready for Drive Up",
          `Your order with ID ${product.orderId} is ready for drive up.`,
          product.orderId
        );
      } else {
        return res.status(400).json({
          success: false,
          message: "No valid pickup option selected",
        });
      }

      // // console.log("product", product);
      const updatedRequest = await ProductRequest.findByIdAndUpdate(product._id, product)
        .populate('user', "user_email user_first_name user_phone _id")
        .lean();

      let user = decryptObject(updatedRequest.user);
      return res.status(200).json({
        success: true,
        data: { ...updatedRequest, user: { ...user } },
      });

    } catch (e) {
      return res.status(500).json({
        success: false,
        message: e.message,
      });
    }
  },

  createEmployee: async (req, res) => {
    try {
      const payload = req.body;
      const vendorId = req.user.id;
      // // console.log("hi", vendorId);
      // const user = await User.findById(vendorId);

      // if (!user) {
      //   return response.notFound(res, { message: "Vendor not found" });
      // }
      let mail = hashValue(payload.email,)
      const existingEmployee = await User.findOne({
        email: mail,
        type: "EMPLOYEE",
      });

      if (existingEmployee) {
        return response.conflict(res, { message: "Employee already exists" });
      }
      if (payload.email) {
        payload.user_email_hash = hashValue(payload.email)
        let email = encryptData(payload.email)
        payload.email = email;
        payload.user_email = email;
      }
      if (payload.number) {
        payload.user_phone = encryptData(payload.number)
      }
      if (payload.username) {
        payload.user_first_name = encryptData(payload.username)
      }
      if (payload.lastname) {
        payload.user_last_name = encryptData(payload.lastname)
      }
      const employee = new User({
        ...payload,
        type: "EMPLOYEE",
        // parent_vendor_id: vendorId,
      });

      await mailNotification.sendWelcomeEmailToEmployee({
        email: payload.email,
        name: payload.username,
        password: payload.password,
      });

      employee.password = employee.encryptPassword(payload.password);
      await employee.save();

      return response.ok(res, { message: "Employee created successfully" });
    } catch (error) {
      return response.error(res, error);
    }
  },

  getEmployeeList: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const filter = {
        type: "EMPLOYEE",
        $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }],
      };

      const employees = await User.find(filter)
        .select("-password")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      let decryptedEmployee = decryptArray(employees)
      const indexedEmployees = decryptedEmployee.map((item, index) => ({
        ...(item.toObject?.() || item),
        indexNo: skip + index + 1,
      }));

      const totalEmployees = await User.countDocuments(filter);
      const totalPages = Math.ceil(totalEmployees / limit);

      return res.status(200).json({
        status: true,
        data: indexedEmployees,
        pagination: {
          totalItems: totalEmployees,
          totalPages,
          currentPage: page,
          itemsPerPage: limit,
        },
      });
    } catch (error) {
      return response.error(res, error);
    }
  },

  updateEmployee: async (req, res) => {
    try {
      const payload = req.body;
      const employeeId = req.body.id;
      if (payload.email) {
        payload.user_email_hash = hashValue(payload.email)
        let email = encryptData(payload.email)
        payload.email = email;
        payload.user_email = email;
      }
      if (payload.number) {
        payload.user_phone = encryptData(payload.number)
      }
      if (payload.username) {
        payload.user_first_name = encryptData(payload.username)
      }
      if (payload.lastname) {
        payload.user_last_name = encryptData(payload.lastname)
      }
      const updatedEmployee = await User.findByIdAndUpdate(
        employeeId,
        payload,
        { new: true, runValidators: true }
      );

      if (!updatedEmployee) {
        return response.notFound(res, { message: "Employee not found" });
      }

      return response.ok(res, { message: "Employee updated successfully" });
    } catch (error) {
      return response.error(res, error);
    }
  },

  deleteEmployee: async (req, res) => {
    try {
      const employeeId = req.params.id;

      const employee = await User.findByIdAndUpdate(
        employeeId,
        { isDeleted: true },
        { new: true }
      );

      if (!employee) {
        return response.notFound(res, {
          message: "Employee not found",
        });
      }

      return response.ok(res, {
        message: "Employee deleted successfully",
      });
    } catch (error) {
      // // console.log(error);
      return response.error(res, error);
    }
  },

  getEmployeeById: async (req, res) => {
    try {
      const employeeId = req.params.id;
      const employee = await User.findById(employeeId).select("-password").lean();

      if (!employee) {
        return response.notFound(res, { message: "Employee not found" });
      }

      let decryptedEmployee = decryptObject(employee)
      return response.ok(res, decryptedEmployee);
    } catch (error) {
      return response.error(res, error);
    }
  },

  sendMessageToCustomer: async (req, res) => {
    try {
      const { email, message, templateId, subject } = req.body;
      let decryptedEmail = decryptValue(email)
      if (templateId) {
        await sendMailWithSTemplateViaSendgrid([decryptedEmail], templateId, subject);
      }

      if (message) {
        await mailNotification.MessageToCustomer({
          message: message,
          customerEmail: [decryptedEmail],
          subject,
        });
      }

      return response.ok(res, "message send Successfully");
    } catch (error) {
      return response.error(res, error);
    }
  },

  sendMessageToAllCustomer: async (req, res) => {
    try {
      const { message, templateId, subject } = req.body;

      if (!subject.trim()) {
        return response.error(res, { message: "subjectis required" });
      }

      if (!message.trim() && !templateId.trim()) {
        return response.error(res, {
          message: "Message or Templat ID is required",
        });
      }

      const userList = await User.find({ type: "USER" }).select("user_email user_first_name").lean();

      let users = decryptArray(userList)
      if (!users.length) {
        return response.error(res, "No users found to send messages");
      }

      const failedEmails = [];
      let userEmailList = users.map((user) => user.email);
      const result = [];
      const chunkSize = 1000;
      for (let i = 0; i < userEmailList.length; i += chunkSize) {
        result.push(userEmailList.slice(i, i + chunkSize));
      }

      let group = [];
      for (let i = 0; i < result.length; i++) {
        // // console.log(result);
        try {
          group = result[i];
          if (templateId) {
            await sendMailWithSTemplateViaSendgrid(group, templateId, subject);
          }
          if (message) {
            await mailNotification.MessageToAllCustomer({
              message,
              customerEmail: group,
              subject,
            });
          }
        } catch (err) {
          // failedEmails.push(user.email);
        }
      }

      // ✅ Return response summary
      return response.ok(res, {
        message: "Messages processed successfully",
        totalUsers: users.length,
      });
    } catch (error) {
      // // console.error("Error sending bulk messages:", error);
      return response.error(res, "Failed to send messages");
    }
  },

  suspendUser: async (req, res) => {
    try {
      const { userId } = req.body;

      if (!userId) {
        return response.error(res, "User ID is required");
      }

      const user = await User.findById(userId);
      if (!user) {
        return response.error(res, "User not found");
      }

      const newStatus = user.status === "Suspended" ? "Active" : "Suspended";
      user.status = newStatus;
      // // console.log("user", user);
      await user.save();

      return response.ok(res, {
        message: `User status updated to ${newStatus}`,
        user,
      });
    } catch (error) {
      // // console.error("Error suspending user:", error);
      return response.error(res, error.message || "Failed to suspend Customer");
    }
  },

  getCustomerDashboard: async (req, res) => {
    try {
      const { email, year, month } = req.body;

      if (!email) {
        return response.error(res, "Customer email is required");
      }

      const userReq = await User.findOne({ user_email_hash: hashValue(email) });
      let user = decryptObject(userReq)
      if (!user) {
        return response.error(res, "Customer not found");
      }

      const currentYear = year || new Date().getFullYear();
      const currentMonth = month || new Date().getMonth() + 1;

      const yearStart = new Date(currentYear, 0, 1);
      const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59);

      const monthStart = new Date(currentYear, currentMonth - 1, 1);
      const monthEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59);

      const yearOrders = await ProductRequest.find({
        user: user._id,
        createdAt: { $gte: yearStart, $lte: yearEnd },
      });

      const monthOrders = await ProductRequest.find({
        user: user._id,
        createdAt: { $gte: monthStart, $lte: monthEnd },
      });
      const ordersYear = yearOrders.length;
      const ordersMonth = monthOrders.length;

      const spentYear = yearOrders.reduce((totals, order) => {
        return totals + Number(order.total || 0);
      }, 0);

      const spentMonth = monthOrders.reduce((totals, order) => {
        return totals + Number(order.total || 0);
      }, 0);

      return response.ok(res, {
        message: "Customer dashboard data retrieved successfully",
        username: user.username || "User",
        lastname: user.lastName || "",
        email: user.email,
        ordersYear,
        ordersMonth,
        spentYear: Number(spentYear.toFixed(2)),
        spentMonth: Number(spentMonth.toFixed(2)),
        recentOrders: yearOrders.map((order) => ({
          orderId: order.orderId,
          status: order.status,
          amount: order.total || 0,
          date: order.createdAt,
        })),
      });
    } catch (error) {
      // // console.error(error);
      return response.error(
        res,
        error.message || "An error occurred while fetching dashboard data"
      );
    }
  },

  getAllCustomersStats: async (req, res) => {
    try {
      const { year, month } = req.body;
      const currentYear = year || new Date().getFullYear();

      const users = await User.find(
        {},
        "name firstName lastName email profileImage createdAt"
      );

      const customersWithStats = await Promise.all(
        users.map(async (user) => {
          const yearStart = new Date(currentYear, 0, 1);
          const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59);

          const userOrders = await ProductRequest.find({
            user: user._id,
            createdAt: { $gte: yearStart, $lte: yearEnd },
          });

          const totalSpent = userOrders.reduce((total, order) => {
            return total + (order.totalAmount || order.price || 0);
          }, 0);

          return {
            _id: user._id,
            name: user.name || user.firstName || "User",
            lastName: user.lastName || "",
            email: user.email,
            profileImage: user.profileImage,
            totalOrders: userOrders.length,
            totalSpent: totalSpent.toFixed(2),
            joinDate: user.createdAt,
          };
        })
      );

      return response.ok(res, {
        message: "All customers stats retrieved successfully",
        data: customersWithStats,
      });
    } catch (error) {
      // // console.error(error);
      return response.error(
        res,
        error.message || "An error occurred while fetching customers stats"
      );
    }
  },

  getCustomerOrderHistory: async (req, res) => {
    try {
      const { email, page = 1, limit = 10 } = req.body;

      if (!email) {
        return response.error(res, "Customer email is required");
      }

      const user = await User.findOne({ email: email });
      if (!user) {
        return response.error(res, "Customer not found");
      }

      const skip = (page - 1) * limit;

      const ordersReq = await ProductRequest.find({ user: user._id })
        .populate("user", "name firstName lastName email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();
      let orders = decryptPopulatedData(ordersReq, 'user');

      const totalOrders = await ProductRequest.countDocuments({
        user: user._id,
      });

      return response.ok(res, {
        message: "Customer order history retrieved successfully",
        data: {
          orders,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalOrders / limit),
            totalOrders,
            hasNext: skip + orders.length < totalOrders,
            hasPrev: page > 1,
          },
        },
      });
    } catch (error) {
      // // console.error(error);
      return response.error(
        res,
        error.message || "An error occurred while fetching order history"
      );
    }
  },

  registerDevice: async (req, res) => {
    try {
      const { user, player_id, device_type } = req.body;

      if (!user || !player_id || !device_type) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Upsert the device info
      const device = await Device.findOneAndUpdate(
        { player_id },
        { user, device_type, is_active: true, last_active: new Date() },
        { new: true, upsert: true }
      );

      res.status(200).json(device);
    } catch (error) {
      // // console.error("Error registering device:", error);
      res.status(500).json({ error: "Server error" });
    }
  },

  // Get user devices
  getUserDevices: async (req, res) => {
    try {
      const userId = req.user.id;
      const devices = await Device.find({ user: userId, is_active: true });

      return response.ok(res, {
        message: "Devices retrieved successfully",
        devices,
      });
    } catch (error) {
      // // console.error("Get devices error:", error);
      return response.error(
        res,
        error.message || "An error occurred while fetching devices"
      );
    }
  },

  // Remove/deactivate device
  removeDevice: async (req, res) => {
    try {
      const { player_id } = req.body;
      const userId = req.user.id;

      if (!player_id) {
        return response.badrequest(res, "Player ID is required");
      }

      const device = await Device.findOne({ player_id, user: userId });

      if (!device) {
        return response.badrequest(res, "Device not found");
      }

      device.is_active = false;
      await device.save();

      return response.ok(res, {
        message: "Device removed successfully",
      });
    } catch (error) {
      // // console.error("Remove device error:", error);
      return response.error(
        res,
        error.message || "An error occurred while removing device"
      );
    }
  },

  // Test notification endpoint
  testNotification: async (req, res) => {
    try {
      const { userId, orderId } = req.body;

      if (!userId) {
        return response.badrequest(res, "User ID is required");
      }

      const result = await notify(
        userId,
        "Product Request",
        `Your product request with order ID ${orderId} has been received.`,
        orderId
      );

      // // console.log("Notification result:", result);

      return response.ok(res, {
        message: "Test notification sent successfully",
        data: {
          userId,
          orderId,
        },
      });
    } catch (error) {
      // // console.error("Test notification error:", error);
      return response.error(res, {
        message: error.message || "Failed to send test notification",
        error: error.toString(),
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  },

  changePasswordFOrAdmin: async (req, res) => {
    try {
      const { password, adminId } = req.body;

      let user = await User.findById(adminId);

      if (!user) {
        return response.error(res, { message: "User Id not found" });
      }

      if (user.type !== "ADMIN" && user.type !== "EMPLOYEE") {
        return response.error(res, {
          message: "Only admin and employee can change password",
        });
      }

      user.password = user.encryptPassword(password);
      await user.save();

      return response.ok(res, { message: "Password changed successfully" });
    } catch (error) {
      return response.error(res, error);
    }
  },
  changeBase64: async (req, res) => {
    try {
      const { url } = req.query;
      if (!url) return res.status(400).json({ error: "URL is required" });

      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch image");

      const arrayBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");

      const ext = url.split(".").pop(); // jpeg/png
      res.json({ base64: `data:image/${ext};base64,${base64}` });
    } catch (err) {
      // // console.error(err);
      res.status(500).json({ error: "Failed to convert image to base64" });
    }
  },

  downloadCustomerExcel: async (req, res) => {
    try {
      const usersReq = await User.find().lean();
      let users = decryptArraywithoutKey(usersReq)
      // console.log(users)
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Customers");

      // Define headers
      worksheet.columns = [
        { header: "Name", key: "name", width: 30 },
        { header: "Email", key: "email", width: 40 },
        { header: "Phone Number", key: "phone", width: 20 },
      ];

      // Add rows
      users.forEach((p) => {
        let name = p.username;
        if (p.lastname) {
          name = p.username + " " + p.lastname;
        }
        worksheet.addRow({
          name,
          email: p.email,
          phone: p.number,
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
      // // console.error("Excel export error:", err);
      res.status(500).json({ message: "Failed to generate Excel file" });
    }
  },
};

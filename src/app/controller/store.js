const mongoose = require("mongoose");
const Store = mongoose.model("Store");
const response = require("./../responses");
const mailNotification = require("../services/mailNotification");
// const User = mongoose.model("User");
const User = require("../model/user");



module.exports = {

    createStore: async (req, res) => {
        try {
            const payload = req?.body || {};
            let cat = new Store(payload);
            await cat.save();
            const users = await User.findById(cat.userid);
            // console.log(users);

            if (!users) {
                return response.error(res, { message: 'User  not found' });
            }
            users.type = 'SELLER';
            // console.log("User  before saving:", users);

            try {
                await users.save();
                // console.log("User  type updated to SELLER", users.save());
            } catch (saveError) {
                // console.error("Error saving user:", saveError);
                return response.error(res, { message: 'Failed to update user type' });
            }
            return response.ok(res, { message: 'Your Log in Details will be send in your email please have a look  !' });
        } catch (error) {
            return response.error(res, error);
        }
    },

    getStore: async (req, res) => {
        try {
            let data = {}
            if (req.user.type === 'SELLER') {
                data.userid = req.user.id
            }
            let product = await Store.find(data).populate('category').sort({ 'createdAt': -1 });
            return response.ok(res, product);
        } catch (error) {
            return response.error(res, error);
        }
    },

    getStoreById: async (req, res) => {
        try {
            let product = await Store.findById(req?.params?.id).populate('category');
            return response.ok(res, product);
        } catch (error) {
            return response.error(res, error);
        }
    },



    updateStore: async (req, res) => {
        try {
            const payload = req?.body || {};
            let product = await Store.findByIdAndUpdate(payload?.id, payload, {
                new: true,
                upsert: true,
            });
            return response.ok(res, product);
        } catch (error) {
            return response.error(res, error);
        }
    },


    deleteStore: async (req, res) => {
        try {
            await Store.findByIdAndDelete(req?.params?.id);
            return response.ok(res, { meaasge: "Deleted successfully" });
        } catch (error) {
            return response.error(res, error);
        }
    },

    deleteAllStore: async (req, res) => {
        try {
            const newid = req.body.products.map(f => new mongoose.Types.ObjectId(f))
            await Store.deleteMany({ _id: { $in: newid } });
            return response.ok(res, { meaasge: "Deleted successfully" });
        } catch (error) {
            return response.error(res, error);
        }
    },



};
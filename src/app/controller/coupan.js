const mongoose = require("mongoose");
const Coupon = mongoose.model("Coupon");
const response = require("./../responses");
const { decryptArray, decryptPopulatedOrders, decryptPopulatedData } = require("../../middlewares/codeDecript");
const ProductRequest = mongoose.model("ProductRequest");

module.exports = {

    AddCoupon: async (req, res) => {
        try {
            const payload = req.body;
            const newCoupon = new Coupon(payload);
            const savedCoupon = await newCoupon.save();
            return response.ok(res, { message: 'Coupon Added', savedCoupon });
        } catch (error) {
            return response.error(res, error);
        }
    },


    GetAllCoupons: async (req, res) => {
        try {
            const coupons = await Coupon.find()
                .populate({
                    path: 'userId',
                    select: 'user_first_name user_last_name user_email user_phone',
                    strictPopulate: false
                })
                .lean(); // 🔥 VERY IMPORTANT

            const data = decryptPopulatedData(coupons, 'userId');

            return response.ok(res, data);
        } catch (error) {
            return response.error(res, error);
        }
    },


    ValidateCoupon: async (req, res) => {
        try {
            const { code, cartValue } = req.body;

            const coupon = await Coupon.findOne({ code });
            if (!coupon) {
                return response.notFound(res, { message: 'Coupon not found' });
            }
            if (new Date() > new Date(coupon.expiryDate)) {
                return response.badReq(res, { message: 'Coupon is expired' });
            }
            if (!coupon.isActive) {
                return response.badReq(res, { message: 'Coupon is not active' });
            }
            let discount = 0;
            if (coupon.discountType === 'percentage') {
                discount = (cartValue * coupon.discountValue) / 100;
            } else if (coupon.discountType === 'fixed') {
                discount = coupon.discountValue;
            }
            if (discount > cartValue) {
                return response.badReq(res, { message: 'Discount exceeds total amount' });
            }

            return response.ok(res, { message: 'Offer Applied', discount });

        } catch (error) {
            return response.error(res, error);
        }
    },


    GetCouponById: async (req, res) => {
        try {
            const coupon = await Coupon.findById(req.params.id);
            if (!coupon) return response.notFound(res, { message: 'Coupon not found' });
            return response.ok(res, coupon);
        } catch (error) {
            return response.error(res, error);
        }
    },


    UpdateCoupon: async (req, res) => {
        try {
            const coupon = await Coupon.findById(req.params.id);
            if (!coupon) return response.notFound(res, { message: 'Coupon not found' });
            Object.assign(coupon, req.body);
            const updatedCoupon = await coupon.save();
            return response.ok(res, { message: 'Coupon Updated', updatedCoupon });
        } catch (error) {
            return response.error(res, error);
        }
    },


    DeleteCoupon: async (req, res) => {
        try {
            const coupon = await Coupon.findByIdAndDelete(req.params.id);
            if (!coupon) {
                return response.notFound(res, { message: 'Coupon not found' });
            }
            return response.ok(res, { message: 'Coupon deleted successfully' });
        } catch (error) {
            return response.error(res, error);
        }
    },

    ValidateCouponforUser: async (req, res) => {
        try {
            const { code, cartValue, userId } = req.body;

            const coupon = await Coupon.findOne({ code });
            if (!coupon) {
                return response.notFound(res, { message: 'Coupon not found' });
            }

            if (new Date() > new Date(coupon.expiryDate)) {
                return response.badReq(res, { message: 'Coupon is expired' });
            }

            if (!coupon.isActive) {
                return response.badReq(res, { message: 'Coupon is not active' });
            }

            if (coupon.firstOrder === true) {
                const hasOrder = await ProductRequest.findOne({ user: userId });
                if (hasOrder) {
                    return response.badReq(res, { message: 'This coupon is valid only for your first order.' });
                }
            }

            const minimumAmount = coupon?.minimumAmount || 0;
            if (cartValue < minimumAmount) {
                return response.badReq(res, {
                    message: `Minimum cart value should be $${minimumAmount} to apply this coupon.`,
                });
            }

            const isOnce = coupon.ussageType === 'once';
            const usedUserIds = coupon.userId?.map((user) => user.toString()) || [];
            if (isOnce && usedUserIds.includes(userId.toString())) {
                return response.badReq(res, { message: 'You have already used this coupon.' });
            }

            let discount = 0;
            if (coupon.discountType === 'percentage') {
                discount = (cartValue * coupon.discountValue) / 100;
            } else if (coupon.discountType === 'fixed') {
                discount = coupon.discountValue;
            }

            if (discount > cartValue) {
                return response.badReq(res, { message: 'Discount exceeds total amount.' });
            }

            discount = Number(discount.toFixed(2));

            return response.ok(res, {
                message: 'Offer applied successfully.',
                discount,
            });
        } catch (error) {
            // console.error('Coupon validation error:', error);
            return response.error(res, error);
        }
    },





};

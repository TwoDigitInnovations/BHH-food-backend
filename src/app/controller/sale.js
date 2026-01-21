const mongoose = require('mongoose');
const response = require("./../responses");

const FlashSale = mongoose.model("FlashSale");

module.exports = {
    createFlashSale: async (req, res) => {
        try {
            const payload = req?.body || {};

            if (payload.products && payload.products.length > 0) {
                payload.product = payload.products[0];
                delete payload.products;
            }

            const existingSale = await FlashSale.findOne({
                product: payload.product,
                status: 'ACTIVE',
                endDateTime: { $gt: new Date() }
            });

            if (existingSale) {
                return response.error(res, {
                    message: "This product already has an active sale. Please end the existing sale first.",
                });
            }

            let sale = new FlashSale(payload);
            const flashSale = await sale.save();

            return response.ok(res, flashSale, {
                message: "Flash Sale added successfully",
            });
        } catch (error) {
            return response.error(res, error);
        }
    },

    getFlashSale: async (req, res) => {
        try {
            const { status } = req.query;

            let query = {};
            if (status) {
                query.status = status;
            }
            const flashSales = await FlashSale.find(query)
                .populate('product', 'name categoryName price_slot varients')
                .sort({ createdAt: -1 });

            return response.ok(res, flashSales);
        } catch (error) {
            return response.error(res, error);
        }
    },

    getActiveFlashSales: async (req, res) => {
        try {
            const now = new Date();

            const activeFlashSales = await FlashSale.find({
                status: "ACTIVE",
                startDateTime: { $lte: now },
                endDateTime: { $gt: now },
            }).populate({
                path: "product",
                match: { status: "verified" },
            });

            const filteredFlashSales = activeFlashSales.filter(
                (sale) => sale.product !== null
            );

            return response.ok(res, filteredFlashSales);
        } catch (error) {
            return response.error(res, error);
        }
    },

    updateFlashSale: async (req, res) => {
        try {
            const { id } = req.params;
            const payload = req.body;

            if (payload.product) {
                const existingSale = await FlashSale.findOne({
                    product: payload.product,
                    status: 'ACTIVE',
                    _id: { $ne: id },
                    endDateTime: { $gt: new Date() }
                });

                if (existingSale) {
                    return response.error(res, {
                        message: "This product already has an active sale.",
                    });
                }
            }

            const updatedFlashSale = await FlashSale.findByIdAndUpdate(
                id,
                payload,
                { new: true, runValidators: true }
            ).populate('product', 'name categoryName price_slot images');

            if (!updatedFlashSale) {
                return response.error(res, {
                    message: "Flash sale not found",
                });
            }

            return response.ok(res, updatedFlashSale, {
                message: "Flash Sale updated successfully",
            });
        } catch (error) {
            return response.error(res, error);
        }
    },

    deleteFlashSale: async (req, res) => {
        try {
            const { id } = req.params;

            const deletedFlashSale = await FlashSale.findByIdAndDelete(id);

            if (!deletedFlashSale) {
                return response.error(res, {
                    message: "Flash sale not found",
                });
            }

            return response.ok(res, {
                message: "Flash Sale deleted successfully",
            });
        } catch (error) {
            return response.error(res, error);
        }
    },

    deleteAllFlashSales: async (req, res) => {
        try {
            const result = await FlashSale.deleteMany({});

            if (result.deletedCount === 0) {
                return response.error(res, {
                    message: 'No flash sales found to delete.',
                });
            }

            return response.ok(res, {
                message: `${result.deletedCount} flash sales deleted successfully`,
            });
        } catch (error) {
            return response.error(res, error);
        }
    },

    toggleFlashSaleStatus: async (req, res) => {
        try {
            const { id } = req.params;
            const { status } = req.body;

            if (!['ACTIVE', 'INACTIVE'].includes(status)) {
                return response.error(res, {
                    message: "Invalid status. Use 'ACTIVE' or 'INACTIVE'",
                });
            }

            const updatedFlashSale = await FlashSale.findByIdAndUpdate(
                id,
                { status },
                { new: true, runValidators: true }
            ).populate('product', 'name categoryName price_slot images');

            if (!updatedFlashSale) {
                return response.error(res, {
                    message: "Flash sale not found",
                });
            }

            return response.ok(res, updatedFlashSale, {
                message: `Flash Sale ${status.toLowerCase()} successfully`,
            });
        } catch (error) {
            return response.error(res, error);
        }
    },

    endExpiredFlashSales: async () => {
        try {
            const now = new Date();
            const result = await FlashSale.updateMany(
                {
                    endDateTime: { $lt: now },
                    status: 'ACTIVE'
                },
                {
                    status: 'EXPIRED'
                }
            );

            // console.log(`${result.modifiedCount} flash sales marked as expired.`);
            return result.modifiedCount;
        } catch (error) {
            // console.error('Error updating expired flash sales:', error);
            return 0;
        }
    },

    getFlashSaleByProduct: async (req, res) => {
        try {
            const { productId } = req.params;
            const now = new Date();

            const flashSale = await FlashSale.findOne({
                product: productId,
                status: 'ACTIVE',
                startDateTime: { $lte: now },
                endDateTime: { $gt: now }
            }).populate('product', 'name categoryName price_slot varients');

            if (!flashSale) {
                return response.error(res, {
                    message: "No active flash sale found for this product",
                });
            }

            return response.ok(res, flashSale);
        } catch (error) {
            return response.error(res, error);
        }
    },

    DeleteExpiredCoupons: async (req, res) => {
        try {
            const now = new Date();

            const result = await FlashSale.deleteMany({
                endDateTime: { $lt: now }
            });
            if (result.deletedCount === 0) {
                return response.notFound(res, { message: 'No expired coupons found' });
            }
            // console.log(`Deleted ${result.deletedCount} expired coupons`);
            // console.log("🕑 Cron Cleanup: Expired coupons deleted ->", result.deletedCount);
        } catch (error) {
            // // console.error("❌ Cron Cleanup Failed:", error.message);
        }
    }
};
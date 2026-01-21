const mongoose = require("mongoose");
const Setting = mongoose.model('Setting');
const response = require("./../responses");

module.exports = {

    createSetting: async (req, res) => {
        try {

            const notify = new Setting(req.body)
            const noti = await notify.save();
            return res.status(201).json({
                success: true,
                message: 'Data Saved successfully!',
                data: noti
            })
        } catch (e) {
            return res.status(500).json({
                success: false,
                message: e.message
            });
        }
    },

    getSetting: async (req, res) => {
        try {
            const notifications = await Setting.find({});
            res.status(200).json({
                success: true,
                message: 'Fetched all carosal successfully',
                setting: notifications
            })

        } catch (e) {
            return res.status(500).json({
                success: false,
                message: e.message
            });
        }
    },

    updateSetting: async (req, res) => {
        try {
            const payload = req?.body || {};
            let category = await Setting.findByIdAndUpdate(payload?.id, payload, {
                new: true,
                upsert: true,
            });
            return res.status(200).json({
                success: true,
                message: 'Updated successfully',
                setting: category
            })
        } catch (error) {
            return response.error(res, error);
        }
    }

}
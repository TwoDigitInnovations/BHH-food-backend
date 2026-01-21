const mongoose = require("mongoose");
const UserActionLog = mongoose.model("UserActionLog");

module.exports = {
    logmate: async (req, res, userData) => {
        // res.on('finish', async () => {
        try {
            let data = {}
            if (req.method != 'GET') {
                data = await UserActionLog.create({
                    userId: userData?._id || null,
                    action: req.body.action || req.originalUrl,
                    method: req.method,
                    endpoint: req.originalUrl,
                    ipConfig: req.body.ipConfig,
                    userAgent: req.headers['user-agent'],
                    status: res.statusCode >= 400 ? 'FAILURE' : 'SUCCESS'
                });
            }
            return data
        } catch (err) {
            // Never break API due to logging
            console.error('Action log error:', err.message);
            return err.message
        }
        // });
    }
}
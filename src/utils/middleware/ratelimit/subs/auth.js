const rateLimit = require("express-rate-limit");

module.exports = (app) => {
    app.use(rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 5,
        standardHeaders: true,
        legacyHeaders: false,
        message: { success: false, reason: "Too many attempts, please try again later." }
    }))
};

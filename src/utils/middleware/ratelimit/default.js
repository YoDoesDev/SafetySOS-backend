const rateLimit = require("express-rate-limit");

const ratelimit = rateLimit({
        windowMs: 60 * 60 * 1000,
        limit: 60,
        standardHeaders: true,
        legacyHeaders: false,
        message: { success: false, reason: "Too many attempts, please try again later." }
    })

module.exports = app => {
    app.use(ratelimit);
}
const rateLimit = require("express-rate-limit");

const ratelimit = rateLimit({
        windowMs: 20 * 60 * 1000,
        limit: 10,
        standardHeaders: true,
        legacyHeaders: false,
        message: { success: false, reason: "Too many attempts during authentication, try again later." }
    })

module.exports = ratelimit;
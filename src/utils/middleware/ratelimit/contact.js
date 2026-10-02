const rateLimit = require("express-rate-limit");

const ratelimit = rateLimit({
        windowMs: 10 * 1000,
        limit: 8,
        standardHeaders: true,
        legacyHeaders: false,
        message: { success: false, reason: "Too many actions in contacts, try again later." }
    })

module.exports = ratelimit;
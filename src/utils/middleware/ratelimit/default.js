const rateLimit = require("express-rate-limit");

const ratelimit = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        return req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";
    },
    message: { success: false, reason: "Too many attempts, please try again later." }
})

module.exports = ratelimit;
const rateLimit = require("express-rate-limit");

module.exports = (app) => {
    app.use(rateLimit({
        windowMs: 60 * 1000,
        limit: 60,
        standardHeaders: true,
        legacyHeaders: false
    }))
};
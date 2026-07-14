const logger = require("./logger.js");

module.exports = (app) => {
    // Request Logger
    app.use((req, res, next) => {
        logger.info(`${req.method} ${req.originalUrl}`);
        next();
    });
    
    // 404
    app.use((req, res) => {
        res.status(404).json({
            success: false,
            message: "Endpoint not found."
        });
    });
    
    // Error Handler
    app.use((err, req, res, next) => {
        logger.error(err.stack);
        
        res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    });
}
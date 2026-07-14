require("dotenv").config();
const express = require("express");
const http = require("http");
const helmet = require("helmet");
const cors = require("cors");
const app = express();
const server = http.createServer(app);
const logger = require("./utils/middleware/logger.js");
const { initDb } = require("./utils/data/database.js");
const { initCache } = require("./utils/data/cache.js");
const handleShutdown = require("./utils/handlers/server/handleShutdown.js");

// One-Line Middleware 
app.use(helmet());
app.use(cors({
    origin: process.env.CORS_ORIGIN || "*"
}));
app.use(express.json());

// Async Bootstrapping Function
async function startServer() {
    try {
        // Firing up the database and cache 
        initDb();
        await initCache();
        
        // Calling ratelimit  
        require("./utils/middleware/ratelimit.js")(app);
        
        // Importing routes  
        const healthRoute = require("./routes/health.js");
        // Using routes 
        app.use("/", healthRoute);
        
        // Calling bootstrap  
        require("./utils/middleware/bootstrap.js")(app);
        
        const PORT = process.env.PORT || 3000;
        server.listen(PORT, () => {
            logger.info(`Server listening on port ${PORT}`);
        });
        
        // Listen for Ctrl+C in terminal
        process.on("SIGINT", async () => await handleShutdown("SIGINT", server));
        
        // Listen for termination signals (like from Docker, PM2, or hosting providers)
        process.on("SIGTERM", async () => await handleShutdown("SIGTERM", server));
        
        process.on("unhandledRejection", (reason, promise) => {
            logger.error(`❌ UNHANDLED REJECTION at: ${promise} | Reason: ${reason}`);
        });
        
        process.on("uncaughtException", async (error) => {
            logger.error(`💥 UNCAUGHT EXCEPTION: ${error.message}\nStack: ${error.stack}`);
            logger.warn("Application state unstable due to uncaught exception. Forcing shutdown...");
            await handleShutdown("uncaughtException", server);
        });
    } catch (error) {
        logger.error(`Failed to start server: ${error.message}`);
        process.exit(1);
    }
}

startServer();
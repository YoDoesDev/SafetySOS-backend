if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const dns = require('node:dns');
dns.setDefaultResultOrder('ipv4first');
const express = require("express");
const http = require("http");
const helmet = require("helmet");
const cors = require("cors");
const app = express();

app.set("trust proxy", 1);

const server = http.createServer(app);
const logger = require("./utils/middleware/logger.js");
const { initDb } = require("./utils/data/database.js");
const { initCache } = require("./utils/data/cache.js");
const handleShutdown = require("./utils/handlers/server/handleShutdown.js");

// Core Middleware
app.use(helmet());
app.use(cors({
    origin: process.env.CORS_ORIGIN || "*"
}));
app.use(express.json());

// Async Bootstrapping Function
async function startServer() {
    try {
        // Firing up database and cache 
        initDb();
        await initCache();
        
        // Importing routes and middleware
        const healthRoute = require("./routes/health.js");
        const liveLogsRoute = require("./routes/webNetworkLogger.js");
        const initAuthRoutes = require("./routes/auth/initAuthRoutes.js");
        const networkLogger = require("./utils/middleware/networkLogger.js");
        
        // Mount networkLogger BEFORE routes so it intercepts all traffic
        app.use(networkLogger);

        // Register Routes
        app.use("/health", healthRoute);
        app.use("/live-logs", liveLogsRoute); // <-- MOUNTED: Accessible at https://safetysos-api.onrender.com/live-logs
        initAuthRoutes(app);
        
        // Calling bootstrap  
        require("./utils/middleware/bootstrap.js")(app);
        
        const PORT = process.env.PORT || 3000;
        server.listen(PORT, "0.0.0.0", () => {
            logger.info(`Server listening on port ${PORT}`);
        });
        
        process.on("SIGINT", async () => await handleShutdown("SIGINT", server));
        process.on("SIGTERM", async () => await handleShutdown("SIGTERM", server));
        
        process.on("unhandledRejection", (reason, promise) => {
            logger.error(`UNHANDLED REJECTION at: ${promise} | Reason: ${reason}`);
        });
        
        process.on("uncaughtException", async (error) => {
            logger.error(`UNCAUGHT EXCEPTION: ${error.message}\nStack: ${error.stack}`);
            logger.warn("Application state unstable due to uncaught exception. Forcing shutdown...");
            await handleShutdown("uncaughtException", server);
        });
    } catch (error) {
        logger.error(`Failed to start server: ${error.stack}`);
        process.exit(1);
    }
}

startServer();

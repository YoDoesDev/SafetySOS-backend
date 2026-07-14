const { db } = require("../../data/database.js");
const { cache } = require("../../data/cache.js");
const logger = require("../../middleware/logger.js");

const handleShutdown = async (signal, server) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  // 1. Stop accepting new HTTP requests
  server.close(() => {
    logger.info("HTTP server closed.");
  });
  
  // 2. Safely disconnect from the Redis cache instance
  try {
    if (cache && cache.isOpen) {
      await cache.quit(); // Cleanly tells Redis we are leaving
      logger.info("Redis cache client disconnected cleanly.");
    }
  } catch (err) {
    logger.error(`Error closing Redis connection: ${err.message}`);
  }
  
  // 3. Close the SQLite database file connection
  try {
    if (db && db.open) {
      db.close(); // Saves pending write-ahead logging (WAL) buffers to disk
      logger.info("SQLite database connection closed cleanly.");
    }
  } catch (err) {
    logger.error(`Error closing SQLite connection: ${err.message}`);
  }
  
  logger.info("Graceful shutdown complete. Exiting process safely.");
  process.exit(0);
};

module.exports = handleShutdown;
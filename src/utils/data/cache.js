const { createClient } = require('redis');
const logger = require("../middleware/logger.js")

// 1. Create the client instance
const cache = createClient({
  url: process.env.REDIS_URL,
  socket: {
    connectTimeout: 10000,
    reconnectStrategy: (retries) => Math.min(retries * 500, 3000)
  }
});

// 2. Setup error handling
cache.on('error', (err) => logger.error(`Redis Error ${err}`, err));

// 3. Connect to the server
const initCache = async () => {
  await cache.connect();
  logger.info('Connected to Redis successfully!');
}

module.exports = {
  cache, 
  initCache
}

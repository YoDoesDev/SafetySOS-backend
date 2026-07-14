const { createClient } = require('redis');
const logger = require("../middleware/logger.js")
require('dotenv').config();

// 1. Create the client instance
const cache = createClient({
  url: process.env.REDIS_URL
});

// 2. Setup error handling
cache.on('error', (err) => logger.error('Redis Client Error', err));

// 3. Connect to the server
const initCache = async () => {
  await cache.connect();
  logger.info('Connected to Redis successfully!');
}

module.exports = {
  cache, 
  initCache
}

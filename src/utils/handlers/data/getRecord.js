const { cache } = require("../cache.js");
const TABLE_SCHEMAS = require("../tableSchemas.js");
const { db } = require("../database.js");
const logger = require("../middleware/logger.js");

const getRecord = async (tableName, val1, val2 = null) => {
  const schema = TABLE_SCHEMAS[tableName];
  
  if (!schema) {
    logger.error(`Schema of ${tableName} isn't registered yet.`);
    return null;
  }
  
  const [col1, col2] = schema.keys;
  let query = `SELECT * FROM ${tableName} WHERE ${col1} = ?`;
  const params = [val1];
  
  if (val2 !== null && val2 !== undefined) {
    if (!col2) {
      logger.error(`Table ${tableName} does not support a second key.`);
      return null;
    }
    query += ` AND ${col2} = ?`;
    params.push(val2);
  }

  const cacheKey = (val2 !== null && val2 !== undefined) 
    ? `${tableName}:${val1}:${val2}` 
    : `${tableName}:${val1}`;
  
  let rawData = null;

  // 1. Fetch from Redis Cache
  try {
    const cachedData = await cache.get(cacheKey);
    if (cachedData) {
      rawData = JSON.parse(cachedData);
    }
  } catch (err) {
    logger.error(`Redis read error: ${err.message}`);
  }
  
  // 2. Cache Miss -> Fetch from SQLite DB
  if (!rawData) {
    rawData = db.prepare(query).get(...params);
    
    // Save a copy to Redis if we successfully retrieved it
    if (rawData) {
      try {
        await cache.set(cacheKey, JSON.stringify(rawData), {
          EX: 15 * 60
        });
      } catch (err) {
        logger.error(`Redis write error: ${err.message}`);
      }
    }
  }

  // If no record exists in either DB or Cache, return null early
  if (!rawData) return null;

  // 3. Zod Validation Shield
  if (schema.validator) {
    const validation = schema.validator.safeParse(rawData);
    
    if (!validation.success) {
      logger.error(`[VALIDATION FAILED] Table ${tableName} record failed schema checks:`, validation.error.format());
      
      // If the cache was corrupted, clear it out!
      await cache.del(cacheKey);
      
      throw new Error(`Database record for table '${tableName}' failed validation integrity checks.`);
    }
    
    // Return the cleanly validated, type-casted data!
    return validation.data;
  }
  
  return rawData;
};

module.exports = { getRecord };

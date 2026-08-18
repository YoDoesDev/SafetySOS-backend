const { db } = require("../../data/database.js");
const { cache } = require("../../data/cache.js");
const TABLE_SCHEMAS = require("../../data/tableSchemas.js");
const logger = require("../../middleware/logger.js");

const getRecord = async (tableName, val1, val2 = null, customColumn = null) => {
  const schema = TABLE_SCHEMAS[tableName];
  if (!schema) return null;

  const [col1, col2] = schema.keys;
  const targetColumn = customColumn || col1; // Use custom column if provided!
  
  const cacheKey = customColumn 
    ? `${tableName}:${targetColumn}:${val1}`
    : (val2 !== null && val2 !== undefined) ? `${tableName}:${val1}:${val2}` : `${tableName}:${val1}`;

  // 1. Redis Cache Lookup
  try {
    const cachedData = await cache.get(cacheKey);
    if (cachedData) return JSON.parse(cachedData);
  } catch (err) {
    logger.error(`[REDIS READ ERROR] ${err.message}`);
  }

  // 2. Supabase PostgreSQL Lookup
  let query = db.from(tableName).select("*").eq(targetColumn, val1);
  if (!customColumn && val2 !== null && val2 !== undefined && col2) {
    query = query.eq(col2, val2);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    logger.error(`[SUPABASE SELECT ERROR] ${error.message}`);
    logger.error(data);
    logger.error(error.code);
    return null;
  }

  if (!data) return null;

  // 3. Write to Redis Cache
  try {
    await cache.set(cacheKey, JSON.stringify(data), { EX: 15 * 60 });
  } catch (err) {
    logger.error(`[REDIS WRITE ERROR] ${err.message}`);
  }

  console.log(JSON.stringify(data, null, 2));
  return data;
};

module.exports = { getRecord };

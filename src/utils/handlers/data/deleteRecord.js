const { cache } = require("../../data/cache.js");
const TABLE_SCHEMAS = require("../../data/tableSchemas.js");
const { db } = require("../../data/database.js");
const logger = require("../../middleware/logger.js");
const { getRecord } = require("./getRecord.js"); 

/**
 * Deletes a record from Supabase and evicts it completely from the Redis cache.
 * 
 * @param {string} tableName - Name of the table (e.g., 'accounts')
 * @param {any} val1 - Value of the primary search key (e.g., userId or phoneNo)
 * @param {any} [val2=null] - Optional second key value
 * @returns {Promise<{ data: object|null, result: boolean, reason: string }>} Standardized response
 */
const deleteRecord = async (tableName, val1, val2 = null) => {
  const schema = TABLE_SCHEMAS[tableName];

  // 1. Ensure schema is registered
  if (!schema) {
    const reason = `Schema of ${tableName} isn't registered yet.`;
    logger.error(reason);
    return { data: null, result: false, reason };
  }

  // 2. Fetch the record before deleting it
  // We need the full object to extract all alternative keys for cache eviction
  let recordToDelete;
  try {
    recordToDelete = await getRecord(tableName, val1, val2);
    if (!recordToDelete) {
      return {
        data: null,
        result: true, // Returning true because if it doesn't exist, our end-goal is technically met
        reason: "The requested record could not be found, so no deletion was necessary."
      };
    }
  } catch (err) {
    logger.error(`Error finding record during deletion: ${err.message}`);
    return {
      data: null,
      result: false,
      reason: "Failed to confirm the existence of the record before deletion."
    };
  }

  // 3. Delete from Supabase
  try {
    const [col1, col2] = schema.keys;
    
    if (val2 !== null && val2 !== undefined && !col2) {
      return { 
        data: null, 
        result: false, 
        reason: `Table ${tableName} does not support a second key.` 
      };
    }

    let query = db.from(tableName).delete().eq(col1, val1);

    if (val2 !== null && val2 !== undefined && col2) {
      query = query.eq(col2, val2);
    }

    // Execute deletion and return deleted rows count check
    const { data, error } = await query.select();

    if (error) {
      // PostgreSQL Foreign Key Violation Code: 23503
      if (error.code === "23503") {
        return {
          data: null,
          result: false,
          reason: "This record cannot be deleted because other active data depends on it."
        };
      }
      throw error;
    }

    if (!data || data.length === 0) {
      return {
        data: null,
        result: false,
        reason: "The deletion query executed, but no changes were made to the database."
      };
    }

    // 4. Evict from Cache (Purge the key out of Redis!)
    const cacheKeyValues = schema.keys
      .map(keyName => recordToDelete[keyName])
      .filter(val => val !== undefined && val !== null);

    if (cacheKeyValues.length > 0) {
      const cacheKey = `${tableName}:${cacheKeyValues.join(":")}`;
      try {
        await cache.del(cacheKey);
      } catch (cacheErr) {
        logger.error(`Redis eviction error in deleteRecord: ${cacheErr.message}`);
        // We do not fail the function since the database write succeeded
      }
    }

    // Success! Return the copy of what was deleted in case the controller needs it
    return {
      data: recordToDelete,
      result: true,
      reason: ""
    };

  } catch (dbError) {
    logger.error(`[DATABASE ERROR] ${dbError.message}`);

    return {
      data: null,
      result: false,
      reason: "Something went wrong while removing the record. Please try again."
    };
  }
};

module.exports = { deleteRecord };

const { cache } = require("../cache.js");
const TABLE_SCHEMAS = require("../tableSchemas.js");
const { db } = require("../database.js");
const logger = require("../middleware/logger.js");
const { getRecord } = require("./getRecord.js"); 
const {
  server
} = require("../../../index.js");


/**
 * Deletes a record from SQLite and evicts it completely from the Redis cache.
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

  // 3. Delete from SQLite
  try {
    const [col1, col2] = schema.keys;
    let query = `DELETE FROM ${tableName} WHERE ${col1} = ?`;
    const params = [val1];

    if (val2 !== null && val2 !== undefined) {
      if (!col2) {
        return { 
          data: null, 
          result: false, 
          reason: `Table ${tableName} does not support a second key.` 
        };
      }
      query += ` AND ${col2} = ?`;
      params.push(val2);
    }

    const stmt = db.prepare(query);
    const result = stmt.run(...params);

    if (result.changes === 0) {
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
    let friendlyReason = "Something went wrong while removing the record. Please try again.";

    // Handle foreign key dependency constraints (e.g., trying to delete an account that still has items tied to it)
    if (dbError.message.includes("FOREIGN KEY constraint failed")) {
      friendlyReason = "This record cannot be deleted because other active data depends on it.";
    }

    logger.error(`[DATABASE ERROR] ${dbError.message}`);

    return {
      data: null,
      result: false,
      reason: friendlyReason
    };
  }
};

module.exports = { deleteRecord };

const { cache } = require("../../data/cache.js");
const TABLE_SCHEMAS = require("../../data/tableSchemas.js");
const { db } = require("../../data/database.js");
const logger = require("../../middleware/logger.js");

/**
 * Validates, inserts, and caches a brand-new record into the database.
 * Enforces Zod validation for required fields on initial creation.
 * 
 * @param {string} tableName - Name of the table (e.g., 'accounts')
 * @param {object} inputData - Raw data payload to write
 * @returns {Promise<{ data: object|null, result: boolean, reason: string }>} Standardized response
 */
const createRecord = async (tableName, inputData) => {
  const schema = TABLE_SCHEMAS[tableName];

  // 1. Ensure the schema is registered
  if (!schema) {
    const reason = `Schema of ${tableName} isn't registered yet.`;
    logger.error(reason);
    return { data: null, result: false, reason };
  }

  // 2. Run Zod Validation on the payload (This will enforce required fields!)
  let validatedRecord;
  if (schema.validator) {
    const validation = schema.validator.safeParse(inputData);
    
    if (!validation.success) {
      // Map Zod errors into a clean, readable string
      const friendlyErrors = validation.error.errors
        .map((err) => `${err.path.join(".")}: ${err.message}`)
        .join(", ");
      
      return {
        data: null,
        result: false,
        reason: `Validation failed: ${friendlyErrors}`
      };
    }
    
    validatedRecord = validation.data;
  } else {
    validatedRecord = inputData;
  }

  // 3. Build dynamic SQL INSERT query
  const columns = Object.keys(validatedRecord);
  if (columns.length === 0) {
    return {
      data: null,
      result: false,
      reason: "Cannot insert an empty record."
    };
  }

  try {
    const placeholders = columns.map(() => "?").join(", ");
    const query = `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${placeholders})`;
    
    const stmt = db.prepare(query);
    const info = stmt.run(...Object.values(validatedRecord));

    // Create a copy of the saved record
    const savedRecord = { ...validatedRecord };
    
    // If table has an auto-incrementing primary key (e.g., 'userId') and we didn't provide it,
    // capture the generated row ID from SQLite so our returned object and cache are complete.
    const primaryKey = schema.keys[0];
    if (primaryKey && (savedRecord[primaryKey] === undefined || savedRecord[primaryKey] === null)) {
      savedRecord[primaryKey] = info.lastInsertRowid;
    }

    // 4. Cache the newly saved record in Redis (Write-Through)
    const cacheKeyValues = schema.keys
      .map(keyName => savedRecord[keyName])
      .filter(val => val !== undefined && val !== null);

    if (cacheKeyValues.length > 0) {
      const cacheKey = `${tableName}:${cacheKeyValues.join(":")}`;
      try {
        await cache.set(cacheKey, JSON.stringify(savedRecord), {
          EX: 15 * 60 // Cache for 15 minutes
        });
      } catch (cacheErr) {
        logger.error(`Redis write error in createRecord: ${cacheErr.message}`);
      }
    }

    // Success! Return the completed record
    return {
      data: savedRecord,
      result: true,
      reason: ""
    };

  } catch (dbError) {
    // 5. Handle DB Constraint Failures cleanly
    let friendlyReason = "Something went wrong while creating this record. Please try again.";

    if (dbError.message.includes("UNIQUE constraint failed")) {
      const match = dbError.message.match(/UNIQUE constraint failed: [a-zA-Z0-9_]+\.([a-zA-Z0-9_]+)/);
      
      if (match && match[1]) {
        const column = match[1];
        const fieldLabels = {
          phoneNo: "phone number",
          username: "username",
          email: "email address"
        };
        
        const label = fieldLabels[column] || column;
        friendlyReason = `This ${label} is already registered to another account.`;
      } else {
        friendlyReason = "A record with this unique information already exists.";
      }
    } else if (dbError.message.includes("NOT NULL constraint failed")) {
      const match = dbError.message.match(/NOT NULL constraint failed: [a-zA-Z0-9_]+\.([a-zA-Z0-9_]+)/);
      if (match && match[1]) {
        friendlyReason = `The field "${match[1]}" cannot be left blank.`;
      }
    }

    logger.error(`[DATABASE ERROR] ${dbError.message}`);

    return {
      data: null,
      result: false,
      reason: friendlyReason
    };
  }
};

module.exports = { createRecord };

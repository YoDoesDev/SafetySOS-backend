 const { cache } = require("../../data/cache.js");
const TABLE_SCHEMAS = require("../../data/tableSchemas.js");
const { db } = require("../../data/database.js");
const logger = require("../../middleware/logger.js");
const { getRecord } = require("./getRecord.js");

/**
 * Updates an existing record in Supabase and updates its Redis cache.
 * Merges the old record with the new updates, runs validation on the merged result,
 * and handles UI-friendly database constraint error formatting.
 * 
 * @param {string} tableName - Name of the table (e.g., 'users')
 * @param {any} val1 - Value of the primary search key (or custom column value)
 * @param {object} updates - Object containing only the properties you want to change
 * @param {any} [val2=null] - Optional second key value
 * @param {string|null} [customColumn=null] - Optional custom search column
 * @returns {Promise<{ data: object|null, result: boolean, reason: string }>} Standardized response
 */
const updateRecord = async (tableName, val1, updates, val2 = null, customColumn = null) => {
  const schema = TABLE_SCHEMAS[tableName];

  // 1. Ensure schema is registered
  if (!schema) {
    const reason = `Schema of ${tableName} isn't registered yet.`;
    logger.error(reason);
    return { data: null, result: false, reason };
  }

  // Determine target search column
  const [col1, col2] = schema.keys;
  const targetColumn = customColumn || col1;

  // 2. Fetch the existing old record (hits cache first, falls back to DB)
  let oldRecord;
  try {
    oldRecord = await getRecord(tableName, val1, val2, customColumn);
    if (!oldRecord) {
      return {
        data: null,
        result: false,
        reason: "The requested record could not be found."
      };
    }
  } catch (err) {
    logger.error(`Error fetching old record in updateRecord: ${err.message}`);
    return {
      data: null,
      result: false,
      reason: "Failed to retrieve the existing record for updating."
    };
  }

  // 3. Merge old data with new updates
  const mergedRecord = { ...oldRecord, ...updates };

  // 4. Validate full merged record against Zod schema
  let validatedRecord;
  if (schema.validator) {
    const validation = schema.validator.safeParse(mergedRecord);

    if (!validation.success) {
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
    validatedRecord = mergedRecord;
  }

  // 5. Check if any actual fields were passed in updates
  const updateColumns = Object.keys(updates);
  if (updateColumns.length === 0) {
    return {
      data: validatedRecord,
      result: true,
      reason: ""
    };
  }

  try {
    if (!customColumn && val2 !== null && val2 !== undefined && !col2) {
      return {
        data: null,
        result: false,
        reason: `Table ${tableName} does not support a second key.`
      };
    }

    // Build update payload
    const updatePayload = {};
    updateColumns.forEach((col) => {
      updatePayload[col] = validatedRecord[col];
    });

    // Execute dynamic query targeting customColumn or schema key
    let query = db.from(tableName).update(updatePayload).eq(targetColumn, val1);

    if (!customColumn && val2 !== null && val2 !== undefined && col2) {
      query = query.eq(col2, val2);
    }

    const { data, error } = await query.select();

    if (error) {
      // PostgreSQL Unique Violation: Code 23505
      if (error.code === "23505") {
        let friendlyReason = "A record with this unique information already exists.";
        const detail = error.detail || "";

        const match = detail.match(/Key \(([^)]+)\)=/);
        if (match && match[1]) {
          const column = match[1];
          const fieldLabels = {
            phoneNo: "phone number",
            username: "username",
            email: "email address"
          };
          const label = fieldLabels[column] || column;
          friendlyReason = `This ${label} is already registered to another account.`;
        }

        return { data: null, result: false, reason: friendlyReason };
      }

      // PostgreSQL Not Null Violation: Code 23502
      if (error.code === "23502") {
        const column = error.column || "field";
        return {
          data: null,
          result: false,
          reason: `The field "${column}" cannot be left blank.`
        };
      }

      throw error;
    }

    if (!data || data.length === 0) {
      return {
        data: null,
        result: false,
        reason: "No changes were made to the database."
      };
    }

    // 6. Update Redis Cache Keys
    // Write back to primary schema cache key format
    const primaryCacheKey = (!customColumn && val2 !== null && val2 !== undefined)
      ? `${tableName}:${val1}:${val2}`
      : `${tableName}:${val1}`;

    try {
      await cache.set(primaryCacheKey, JSON.stringify(validatedRecord), { EX: 15 * 60 });

      // If updated via custom column or custom column value changed, update/evict custom key as well
      if (customColumn) {
        const customCacheKey = `${tableName}:${customColumn}:${val1}`;
        await cache.set(customCacheKey, JSON.stringify(validatedRecord), { EX: 15 * 60 });
      }
    } catch (cacheErr) {
      logger.error(`Redis write error in updateRecord: ${cacheErr.message}`);
    }

    return {
      data: validatedRecord,
      result: true,
      reason: ""
    };

  } catch (dbError) {
    logger.error(`[DATABASE ERROR] ${dbError.message}`);

    return {
      data: null,
      result: false,
      reason: "Something went wrong while saving your changes. Please try again."
    };
  }
};

module.exports = { updateRecord };

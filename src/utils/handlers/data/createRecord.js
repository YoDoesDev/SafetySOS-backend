const { db } = require("../../data/database.js");
const TABLE_SCHEMAS = require("../../data/tableSchemas.js");
const logger = require("../../middleware/logger.js");

const createRecord = async (tableName, inputData) => {
  const schema = TABLE_SCHEMAS[tableName];

  if (!schema) {
    return { data: null, result: false, reason: `Schema of ${tableName} isn't registered.` };
  }

  // 1. Zod Validation
  if (schema.validator) {
    const validation = schema.validator.safeParse(inputData);
    if (!validation.success) {
      const friendlyErrors = validation.error.errors.map(err => `${err.path.join(".")}: ${err.message}`).join(", ");
      return { data: null, result: false, reason: `Validation failed: ${friendlyErrors}` };
    }
  }

  try {
    // 2. Supabase Insert
    const { data, error } = await db
      .from(tableName)
      .insert([inputData])
      .select()
      .single();

    if (error) {
      // PostgreSQL Unique Constraint Violation (Code 23505)
      if (error.code === "23505") {
        return {
          data: null,
          result: false,
          reason: "An account with these details (username, phone, or UID) already exists."
        };
      }
      throw error;
    }

    return { data, result: true, reason: "" };

  } catch (err) {
    logger.error(`[SUPABASE INSERT ERROR] ${err.message}`);
    return {
      data: null,
      result: false,
      reason: "Internal database error while creating record."
    };
  }
};

module.exports = { createRecord };

const { z } = require("zod");

/**
 * Global Table Schemas Configurations
 * - keys: Columns used for database lookups and building Redis cache keys.
 * - validator: The Zod schema that enforces type-safety and field constraints.
 */
const TABLE_SCHEMAS = {
  accounts: {
    keys: ["userId", "phoneNo"],
    validator: z.object({
      userId: z.number().int().positive().optional(),
      username: z
        .string()
        .trim()
        .min(3, "Username must be at least 3 characters long")
        .max(30, "Username cannot exceed 30 characters"), 
        
      phoneNo: z
        .string()
        .trim()
        .min(10, "Phone number must be at least 10 digits")
        .max(15, "Phone number cannot exceed 15 digits"),
        
      passwordHash: z.string().min(1, "Password hash cannot be empty")
    })
  }
};

module.exports = TABLE_SCHEMAS;

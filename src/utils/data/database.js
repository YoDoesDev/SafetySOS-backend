const { createClient } = require("@supabase/supabase-js");
const logger = require("../middleware/logger.js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  logger.error("[DATABASE] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables!");
}

// Service role client bypasses RLS for admin operations (password hashing, user management)
const db = createClient(supabaseUrl, supabaseKey);

const initDb = () => {
  // Supabase tables are initialized via the Supabase SQL Editor.
  // This helper stays for compatibility if app initialization code calls initDb().
  logger.info("[DATABASE] Connected to Supabase PostgreSQL!");
};

module.exports = {
  initDb,
  db
};

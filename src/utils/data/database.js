const path = require("path");
const Database = require("better-sqlite3");
const logger = require("../middleware/logger.js")

const db = new Database(path.join(__dirname, '..', '..', 'sos.sqlite'));

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

logger.info("[DATABASE] Connected to sos.sqlite");

const initDb = () => {
  
  db.prepare(`
    CREATE TABLE IF NOT EXISTS accounts (
    userId INTEGER PRIMARY KEY AUTOINCREMENT, 
    phoneNo TEXT NOT NULL UNIQUE, 
    username TEXT NOT NULL, 
    passwordHash TEXT NOT NULL
  )`).run();
  
  db.run(`
    CREATE TABLE IF NOT EXISTS emergency_chat (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id TEXT NOT NULL,
      receiver_id TEXT NOT NULL,
      message_text TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_chat_pairs 
    ON emergency_chat (sender_id, receiver_id)
  `);
  
  logger.info("All tables are ready!");
};

module.exports = {
  initDb, 
  db
}
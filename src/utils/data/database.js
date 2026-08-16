const path = require("path");
const Database = require("better-sqlite3");
const logger = require("../middleware/logger.js")

const db = new Database(path.join(__dirname, '..', '..', 'sos.sqlite'));

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

logger.info("[DATABASE] Connected to sos.sqlite");

const initDb = () => {
  
  db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
    userId INTEGER PRIMARY KEY AUTOINCREMENT, 
    uid TEXT NOT NULL UNIQUE
    phoneNo TEXT NOT NULL UNIQUE, 
    username TEXT NOT NULL, 
    passwordHash TEXT NOT NULL
  )`).run();
  
  db.prepare(`
    CREATE TABLE IF NOT EXISTS emergency_chat (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id TEXT NOT NULL,
      receiver_id TEXT NOT NULL,
      message_text TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_chat_pairs 
    ON emergency_chat (sender_id, receiver_id)
  `).run();
  
  logger.info("All tables are ready!");
};

module.exports = {
  initDb, 
  db
}
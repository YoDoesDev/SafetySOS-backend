const express = require('express');
const router = express.Router();
const { recentLogs } = require('../utils/middleware/networkLogger.js');

router.get('/', (req, res) => {
  const formattedLogs = recentLogs
    .map(l => `[${l.time}]\n${l.text}`)
    .reverse()
    .join('\n\n');

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Render Live Server Logs</title>
      <meta http-equiv="refresh" content="2">
      <style>
        body { background: #0d1117; color: #58a6ff; font-family: monospace; padding: 20px; font-size: 15px; }
        h2 { color: #8b949e; border-bottom: 1px solid #30363d; padding-bottom: 8px; }
        pre { background: #161b22; color: #7ee787; padding: 15px; border-radius: 6px; white-space: pre-wrap; word-wrap: break-word; border: 1px solid #30363d; }
      </style>
    </head>
    <body>
      <h2>🚀 Live Render Server OSI Stack Logs</h2>
      <p style="color: #8b949e;">Auto-refreshing every 2 seconds...</p>
      <pre>${formattedLogs || 'No network requests logged yet. Trigger pingscript.sh from Termux!'}</pre>
    </body>
    </html>
  `);
});

module.exports = router;

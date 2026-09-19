const logger = require('./logger.js');

// In-memory ring buffer for the HTML live-logs viewer
const recentLogs = [];

const networkLogger = (req, res, next) => {
  const socket = req.socket;
  
  // Extract true public IP forwarded by Render's reverse proxy
  const realClientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip;
  const proto = req.headers['x-forwarded-proto'] || (socket.encrypted ? 'https' : 'http');

  // Time calculations
  const now = new Date();
  const utcTime = now.toUTCString();
  const istTime = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true });

  const logBlock = [
    '================ [ INCOMING NETWORK TRAFFIC ] ================',
    `[Timestamp]    IST: ${istTime} | UTC: ${utcTime}`,
    `[L3 Network]   Public Client IP: ${realClientIp} | Container Local IP: ${socket.localAddress}`,
    `[L4 Transport] Source Port: ${socket.remotePort} -> Dest Port: ${socket.localPort}`,
    `[L4 Transport] Protocol: TCP | Edge Encrypted: ${proto.toUpperCase()}`,
    `[L7 App]       HTTP ${req.method} ${req.url} - User-Agent: ${req.get('User-Agent') || 'N/A'}`,
    '============================================================='
  ].join('\n');

  // Push to memory buffer (keep last 20 requests)
  recentLogs.push({
    timeIST: istTime,
    timeUTC: utcTime,
    text: logBlock
  });
  if (recentLogs.length > 20) recentLogs.shift();

  // Log to Winston stdout (Render Dashboard)
  logger.info(`\n${logBlock}\n`);

  next();
};

// Export both the middleware function AND the recentLogs array
module.exports = networkLogger;
module.exports.recentLogs = recentLogs;

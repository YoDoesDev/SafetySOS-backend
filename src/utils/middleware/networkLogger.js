const logger = require('./logger.js');

const recentLogs = [];

const networkLogger = (req, res, next) => {
  // 1. Ignore auto-refreshes from the live-logs web page itself
  if (req.originalUrl === '/live-logs' || req.url === '/live-logs') {
    return next();
  }

  // 2. FILTER: Only record requests sent with your secret header
  // (Change 'my-demo-2026' to whatever secret key you want!)
  const isDemoPing = req.headers['x-presentation-token'] === 'my-demo-2026';

  const socket = req.socket;
  const realClientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip;
  const proto = req.headers['x-forwarded-proto'] || (socket.encrypted ? 'https' : 'http');

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

  // ONLY push to the projector buffer if it's YOUR ping!
  if (isDemoPing) {
    recentLogs.push({
      time: istTime,
      text: logBlock
    });
    if (recentLogs.length > 20) recentLogs.shift();
  }

  // Still write ALL traffic to Winston console logs for server debugging
  logger.info(`\n${logBlock}\n`);

  next();
};

module.exports = networkLogger;
module.exports.recentLogs = recentLogs;

const logger = require('./logger.js');

const recentLogs = [];

const networkLogger = (req, res, next) => {
  if (req.originalUrl === '/live-logs' || req.url === '/live-logs') {
    return next();
  }

  const isDemoPing = req.headers['x-presentation-token'] === 'my-demo-2026';

  const socket = req.socket;
  const realClientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip;
  const proto = req.headers['x-forwarded-proto'] || (socket.encrypted ? 'https' : 'http');

  // Extract client-side timing metrics from custom headers
  const tcpConnect = req.headers['x-client-tcp-connect'] || 'N/A';
  const tlsHandshake = req.headers['x-client-tls-handshake'] || 'N/A';
  const totalTime = req.headers['x-client-total-time'] || 'N/A';

  const now = new Date();
  const utcTime = now.toUTCString();
  const istTime = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true });

  const logBlock = [
    '================ [ INCOMING NETWORK TRAFFIC ] ================',
    `[Timestamp]    IST: ${istTime} | UTC: ${utcTime}`,
    `[L3 Network]   Public Client IP: ${realClientIp} | Container Local IP: ${socket.localAddress}`,
    `[L4 Transport] Source Port: ${socket.remotePort} -> Dest Port: ${socket.localPort}`,
    `[L4 Transport] Protocol: TCP | Edge Encrypted: ${proto.toUpperCase()}`,
    `[L4 Metrics]   TCP Connect: ${tcpConnect} | TLS Handshake: ${tlsHandshake} | Total: ${totalTime}`,
    `[L7 App]       HTTP ${req.method} ${req.url} - User-Agent: ${req.get('User-Agent') || 'N/A'}`,
    '============================================================='
  ].join('\n');

  if (isDemoPing) {
    recentLogs.push({
      time: istTime,
      text: logBlock
    });
    if (recentLogs.length > 20) recentLogs.shift();
  }

  logger.info(`\n${logBlock}\n`);

  next();
};

module.exports = networkLogger;
module.exports.recentLogs = recentLogs;

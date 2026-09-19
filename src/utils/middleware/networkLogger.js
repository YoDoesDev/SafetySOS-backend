 const logger = require('./logger.js');
 
 const networkLogger = (req, res, next) => {
  const socket = req.socket;
  const isEncrypted = Boolean(socket.encrypted);

  const cipherInfo = isEncrypted && typeof socket.getCipher === 'function' 
    ? socket.getCipher().name 
    : 'N/A';
  
  const tlsVersion = isEncrypted && typeof socket.getProtocol === 'function' 
    ? socket.getProtocol() 
    : 'N/A';

  // Format the structured output for Winston
  logger.info('\n================ [ INCOMING NETWORK TRAFFIC ] =================');
  logger.info(`[L3 Network]   Client IP: ${req.ip} | Local Server IP: ${socket.localAddress}`);
  logger.info(`[L4 Transport] Source Port: ${socket.remotePort} -> Dest Port: ${socket.localPort}`);
  logger.info(`[L4 Transport] Protocol: TCP | Encrypted: ${isEncrypted ? 'TLS/SSL' : 'None'}`);
  
  if (isEncrypted) {
    logger.info(`[L4 TLS/SSL]   Cipher: ${cipherInfo} | Protocol Version: ${tlsVersion}`);
  }
  
  logger.info(`[L7 App]       HTTP ${req.method} ${req.url} - User-Agent: ${req.get('User-Agent') || 'N/A'}`);
  logger.info('=============================================================\n');

  next();
};

module.exports = networkLogger
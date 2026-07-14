const jwt = require("jsonwebtoken");
const { cache } = require("../data/cache.js");
const crypto = require("crypto"); // Fixed import syntax
require("dotenv").config();

// Helper function to securely hash a token string
const hashAToken = token => {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
};

const generateAccessToken = payload => {
  // Signed for 7 days
  const token = jwt.sign(payload, process.env.ACCESS_KEY, {
    expiresIn: "7d"
  });
  
  const hashed = hashAToken(token);
  // Fixed: 'EX' accepts seconds, so removed '* 1000'
  cache.set(`accToken:${payload.userId}`, hashed, {
    EX: 7 * 24 * 60 * 60 
  });
  
  return token;
};

const generateRefreshToken = payload => {
  // Lifetime token (no expiresIn property)
  const token = jwt.sign(payload, process.env.REFRESH_KEY);
  
  const hashed = hashAToken(token);
  // Store it in cache without an expiration so it lasts forever
  cache.set(`refToken:${payload.userId}`, hashed);
  
  return token;
};

const verifyToken = async (which, token, payload) => {
  const hashed = hashAToken(token);
  
  // Note: Depending on your cache library, you might need to 'await' this get call
  const storedHash = await cache.get(`${which}Token:${payload.userId}`);
  
  if (hashed === storedHash) {
    // Generate new tokens (these functions handle their own cache storing internally!)
    const accToken = generateAccessToken(payload);
    const refToken = generateRefreshToken(payload);
    
    return {
      result: true,
      newAccToken: accToken,
      newRefToken: refToken
    };
  }
  
  return false;
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyToken
};

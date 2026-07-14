const jwt = require("jsonwebtoken");
const { cache } = require("../data/cache.js");
const crypto = require("crypto");
const argon2 = require("argon2");
require("dotenv").config();

/* ==================== TOKEN HASHING (for Redis) ==================== */
// Fast + secure hashing for storing tokens in Redis
const hashToken = (token) => {
  return crypto
    .createHmac("sha256", process.env.ACCESS_KEY || "fallback-secret")
    .update(token)
    .digest("hex");
};

/* ==================== PASSWORD HASHING (Argon2) ==================== */
const hashPassword = async (password) => {
  return await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 2 ** 16, // 64MB
    timeCost: 3,
    parallelism: 1,
  });
};

const verifyPassword = async (password, hashedPassword) => {
  try {
    return await argon2.verify(hashedPassword, password);
  } catch {
    return false;
  }
};

/* ==================== TOKEN GENERATORS ==================== */
const generateAccessToken = (payload) => {
  const token = jwt.sign(payload, process.env.ACCESS_KEY, {
    expiresIn: "15m", // ← Shorter interval
  });

  const hashed = hashToken(token);
  cache.set(`accToken:${payload.userId}`, hashed, {
    EX: 15 * 60, // 15 minutes
  });

  return token;
};

const generateRefreshToken = (payload) => {
  const token = jwt.sign(payload, process.env.REFRESH_KEY, {
    expiresIn: "30d", // ← Now has finite expiry
  });

  const hashed = hashToken(token);
  cache.set(`refToken:${payload.userId}`, hashed, {
    EX: 30 * 24 * 60 * 60, // 30 days
  });

  return token;
};

/* ==================== SEPARATE VERIFY HANDLERS ==================== */

// Verifies access token + rotates both tokens if valid
const verifyAccessToken = async (accessToken) => {
  try {
    const decoded = jwt.verify(accessToken, process.env.ACCESS_KEY);
    const hashed = hashToken(accessToken);
    const storedHash = await cache.get(`accToken:${decoded.userId}`);

    if (hashed !== storedHash) {
      return { result: false, reason: "Invalid or expired access token" };
    }

    // Rotation (as you wanted)
    const newAccessToken = generateAccessToken(decoded);
    const newRefreshToken = generateRefreshToken(decoded);

    return {
      result: true,
      payload: decoded,
      newAccessToken,
      newRefreshToken,
    };
  } catch (err) {
    return { result: false, reason: err.message };
  }
};

// Verifies refresh token + issues new pair if valid
const verifyRefreshToken = async (refreshToken) => {
  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_KEY);
    const hashed = hashToken(refreshToken);
    const storedHash = await cache.get(`refToken:${decoded.userId}`);

    if (hashed !== storedHash) {
      return { result: false, reason: "Invalid or expired refresh token" };
    }

    // Issue fresh pair
    const newAccessToken = generateAccessToken(decoded);
    const newRefreshToken = generateRefreshToken(decoded);

    return {
      result: true,
      payload: decoded,
      newAccessToken,
      newRefreshToken,
    };
  } catch (err) {
    return { result: false, reason: err.message };
  }
};

module.exports = {
  // Password
  hashPassword,
  verifyPassword,

  // Tokens
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
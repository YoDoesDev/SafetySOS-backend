const jwt = require("jsonwebtoken");
const { cache } = require("../data/cache.js");
const crypto = require("crypto");
const argon2 = require("argon2");

/* ==================== TOKEN HASHING ==================== */
const hashToken = (token) => {
  return crypto
    .createHmac("sha256", process.env.ACCESS_KEY)
    .update(token)
    .digest("hex");
};

/* ==================== PASSWORD HASHING ==================== */
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

/* ==================== HELPER: PAYLOAD SANITIZER ==================== */
const sanitizePayload = (payload) => {
  return {
    userId: payload.userId, 
    username: payload.username, 
    phoneNo: payload.phoneNo,
    deviceId: payload.deviceId
  };
};

/* ==================== TOKEN GENERATORS ==================== */
const generateAccessToken = async (payload) => {
  const cleanPayload = sanitizePayload(payload);
  const token = jwt.sign(cleanPayload, process.env.ACCESS_KEY, {
    expiresIn: "120m",
  });

  const hashed = hashToken(token);
  await cache.set(`accToken:${cleanPayload.userId}:${cleanPayload.deviceId}`, hashed, {
    EX: 120 * 60,
  });

  return token;
};

const generateRefreshToken = async (payload) => {
  const cleanPayload = sanitizePayload(payload);
  const token = jwt.sign(cleanPayload, process.env.REFRESH_KEY, {
    expiresIn: "30d",
  });

  const hashed = hashToken(token);
  await cache.set(`refToken:${cleanPayload.userId}:${cleanPayload.deviceId}`, hashed, {
    EX: 30 * 24 * 60 * 60,
  });

  return token;
};

/* ==================== VERIFICATION HANDLERS ==================== */

// Pure validation for standard requests (No auto-rotation)
const verifyAccessToken = async (accessToken) => {
  try {
    const decoded = jwt.verify(accessToken, process.env.ACCESS_KEY);
    const hashed = hashToken(accessToken);
    const storedHash = await cache.get(`accToken:${decoded.userId}:${decoded.deviceId}`);

    if (!storedHash || hashed !== storedHash) {
      return { result: false, reason: "Invalid or revoked access token" };
    }

    return { result: true, payload: decoded };
  } catch (err) {
    return { result: false, reason: err.message };
  }
};

// Validates refresh token + performs rotation
const verifyRefreshToken = async (refreshToken) => {
  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_KEY);
    const hashed = hashToken(refreshToken);
    const storedHash = await cache.get(`refToken:${decoded.userId}:${decoded.deviceId}`);

    if (!storedHash || hashed !== storedHash) {
      return { result: false, reason: "Invalid or revoked refresh token" };
    }

    // Generate new pair upon valid refresh
    const newAccessToken = await generateAccessToken(decoded);
    const newRefreshToken = await generateRefreshToken(decoded);

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

// Verifies signature (expiry ignored so expired sessions can still log out),
// then deletes the access token hash from cache. Forged tokens are ignored.
const revokeAccessToken = async (accessToken) => {
  try {
    const decoded = jwt.verify(accessToken, process.env.ACCESS_KEY, {
      ignoreExpiration: true,
    });
    await cache.del(`accToken:${decoded.userId}:${decoded.deviceId}`);
    return { result: true };
  } catch (err) {
    return { result: false, reason: "Invalid token" };
  }
};

// Same for the refresh token
const revokeRefreshToken = async (refreshToken) => {
  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_KEY, {
      ignoreExpiration: true,
    });
    await cache.del(`refToken:${decoded.userId}:${decoded.deviceId}`);
    return { result: true };
  } catch (err) {
    return { result: false, reason: "Invalid token" };
  }
};


module.exports = {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  revokeAccessToken,
  revokeRefreshToken
};

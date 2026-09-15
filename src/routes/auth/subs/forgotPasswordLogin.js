const express = require("express");
const router = express.Router();

// Corrected import paths
const { getRecord } = require("../../../utils/handlers/data/getRecord.js");
const { updateRecord } = require("../../../utils/handlers/data/updateRecord.js");

const ratelimiter = require("../../../utils/middleware/ratelimit/auth.js");

const { 
  generateAccessToken, 
  generateRefreshToken 
} = require("../../../utils/middleware/jwtHandlers.js");

const logger = require("../../../utils/middleware/logger.js");

router.post("/auth/forgot-password-login", ratelimiter, async (req, res) => {
  try {
    const { uid, phone } = req.body;

    // Validate payload
    if (!uid || !phone) {
      return res.status(400).json({
        success: false,
        reason: "Both phone number and verification UID are required.",
        accessToken: null,
        refreshToken: null
      });
    }

    // 1. Retrieve existing user by phone number
    const row = await getRecord("users", phone, null, "phoneNo");
    
    if (!row) {
      return res.status(404).json({
        success: false, 
        reason: "Phone number not registered.",
        accessToken: null,
        refreshToken: null
      });
    }
    
    // 2. Update user's Firebase UID in database & Redis
    const updateRes = await updateRecord("users", phone, { uid: uid }, null, "phoneNo");

    if (!updateRes.result) {
      return res.status(500).json({
        success: false,
        reason: updateRes.reason || "Failed to update security verification.",
        accessToken: null,
        refreshToken: null
      });
    }

    // 3. Issue fresh access and refresh tokens
    const payload = {
      userId: row.userId, 
      username: row.username, 
      phoneNo: row.phoneNo
    };

    const aToken = await generateAccessToken(payload);
    const rToken = await generateRefreshToken(payload);

    return res.status(200).json({
      success: true, 
      reason: "Verification successful.", 
      accessToken: aToken, 
      refreshToken: rToken
    });
    
  } catch (err) {
    logger.error("Internal Error in forgot-password-login: " + err.stack);
    return res.status(500).json({
      success: false, 
      reason: "Internal Server Error 500",
      accessToken: null,
      refreshToken: null
    });
  }
});

module.exports = router;

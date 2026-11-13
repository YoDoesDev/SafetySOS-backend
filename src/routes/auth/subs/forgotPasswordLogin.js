const express = require("express");
const router = express.Router();

const { getRecord } = require("../../../utils/handlers/data/getRecord.js");
const { updateRecord } = require("../../../utils/handlers/data/updateRecord.js");
const ratelimiter = require("../../../utils/middleware/ratelimit/auth.js");
const { verifyPhoneIdToken } = require("../../../utils/middleware/firebaseVerify.js");
const {
  generateAccessToken,
  generateRefreshToken,
} = require("../../../utils/middleware/jwtHandlers.js");
const logger = require("../../../utils/middleware/logger.js");

router.post("/auth/forgot-password-login", ratelimiter, async (req, res) => {
  try {
    const { idToken, phone } = req.body;
    const deviceId = req.headers["x-device-id"];
    
    if (!idToken || !phone) {
      return res.status(400).json({
        success: false,
        reason: "Phone number and verification token are required.",
        accessToken: null,
        refreshToken: null,
        username: null,
        phone: null
      });
    }
    
    if (!deviceId) {
      return res.status(400).json({ success: false, reason: "Device ID not given." });
    }
    
    // Server-side proof that this phone really passed Firebase OTP
    const check = await verifyPhoneIdToken(idToken, phone);
    if (!check.ok) {
      return res.status(401).json({
        success: false,
        reason: check.reason,
        accessToken: null,
        refreshToken: null,
        username: null,
        phone: null
      });
    }
    
    const row = await getRecord("users", phone, null, "phoneNo");
    if (!row) {
      return res.status(404).json({
        success: false,
        reason: "Phone number not registered.",
        accessToken: null,
        refreshToken: null,
        username: null,
        phone: null
      });
    }
    
    // Use the uid from the verified token, never one sent by the client
    const updateRes = await updateRecord("users", phone, { uid: check.uid }, null, "phoneNo");
    if (!updateRes.result) {
      return res.status(500).json({
        success: false,
        reason: updateRes.reason || "Failed to update security verification.",
        accessToken: null,
        refreshToken: null,
      });
    }
    
    const payload = {
      userId: row.userId,
      username: row.username,
      phoneNo: row.phoneNo,
      deviceId,
    };
    
    const aToken = await generateAccessToken(payload);
    const rToken = await generateRefreshToken(payload);
    
    return res.status(200).json({
      success: true,
      reason: "Verification successful.",
      accessToken: aToken,
      refreshToken: rToken,
      username: row.username,
      phone: row.phoneNo,
    });
  } catch (err) {
    logger.error("Internal Error in forgot-password-login: " + err.stack);
    return res.status(500).json({
      success: false,
      reason: "Internal Server Error 500",
      accessToken: null,
      refreshToken: null,
      username: null,
      phone: null
    });
  }
});

module.exports = router;
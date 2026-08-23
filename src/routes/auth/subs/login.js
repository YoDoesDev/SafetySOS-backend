const express = require("express");
const router = express.Router();
const { getRecord } = require("../../../utils/handlers/data/getRecord.js");
const { 
  verifyPassword, 
  generateAccessToken, 
  generateRefreshToken 
} = require("../../../utils/middleware/jwtHandlers.js");
const logger = require("../../../utils/middleware/logger.js");

router.post("/auth/login", async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        reason: "Phone number and password are required."
      });
    }

    const row = await getRecord("users", phone, null, "phoneNo");
    
    if (!row) {
      return res.status(401).json({
        success: false, 
        reason: "Incorrect phone or password."
      });
    }

    const isPasswordValid = await verifyPassword(password, row.passwordHash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false, 
        reason: "Incorrect phone or password."
      });
    }

    const payload = {
      userId: row.uid, 
      username: row.username, 
      phoneNo: row.phoneNo
    };

    const aToken = await generateAccessToken(payload);
    const rToken = await generateRefreshToken(payload);

    return res.status(200).json({
      accessToken: aToken, 
      refreshToken: rToken
    });

  } catch (error) {
    logger.error(`Login error: ${error.message}`);
    return res.status(500).json({
      success: false,
      reason: "An unexpected error occurred. Please try again."
    });
  }
});

module.exports = router;

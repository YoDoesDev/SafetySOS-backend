const express = require("express");
const router = express.Router();
const { getRecord } = require("../../../utils/handlers/data/getRecord.js");
const { createRecord } = require("../../../utils/handlers/data/createRecord.js");
const {
  hashPassword,
  generateAccessToken,
  generateRefreshToken,
} = require("../../../utils/middleware/jwtHandlers.js");
const { verifyPhoneIdToken } = require("../../../utils/middleware/firebaseVerify.js");
const logger = require("../../../utils/middleware/logger.js");
const ratelimiter = require("../../../utils/middleware/ratelimit/auth.js");

router.post("/auth/register", ratelimiter, async (req, res) => {
  const { username, phone, password, idToken } = req.body;
  const deviceId = req.headers["x-device-id"];

  if (!username) return res.status(400).json({ navigateToHome: false, reason: "Username field is empty" });
  if (!phone) return res.status(400).json({ navigateToHome: false, reason: "Phone field is empty" });
  if (!password) return res.status(400).json({ navigateToHome: false, reason: "Password field is empty" });
  if (!idToken) return res.status(400).json({ navigateToHome: false, reason: "Verification token is missing" });
  if (!deviceId) return res.status(400).json({ navigateToHome: false, reason: "Device ID not given." });

  try {
    // Prove the phone number was verified by Firebase OTP
    const check = await verifyPhoneIdToken(idToken, phone);
    if (!check.ok) {
      return res.status(401).json({ navigateToHome: false, reason: check.reason });
    }
    const uid = check.uid; // from the verified token, not the client

    const hashed = await hashPassword(password);

    const createResult = await createRecord("users", {
      username,
      uid,
      phoneNo: phone,
      passwordHash: hashed,
    });

    if (!createResult.result) {
      logger.error(createResult.reason);
      return res.status(200).json({
        navigateToHome: false,
        reason: createResult.reason || "An account with these details already exists.",
      });
    }

    const row = await getRecord("users", phone, null, "phoneNo");

    const payload = {
      userId: row?.userId,
      username: row?.username || username,
      phoneNo: row?.phoneNo || phone,
      deviceId,
    };

    const accessToken = await generateAccessToken(payload);
    const refreshToken = await generateRefreshToken(payload);

    // Kept for compatibility with your current Android DTO.
    // Remove passwordHash here once the app no longer needs it.
    return res.status(200).json({
      username,
      phone,
      passwordHash: hashed,
      uid,
      accessToken,
      refreshToken,
      navigateToHome: true,
    });
  } catch (err) {
    logger.error("Internal Error: " + err.stack);
    return res.status(500).json({ navigateToHome: false, reason: "Internal Server Error 500" });
  }
});

module.exports = router;

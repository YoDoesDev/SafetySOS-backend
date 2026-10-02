const express = require("express");
const router = express.Router();
const logger = require("../../../utils/middleware/logger.js");

const { getRecord } = require("../../../utils/handlers/data/getRecord.js");
const { verifyAccessToken } = require("../../../utils/middleware/jwtHandlers.js");
const ratelimiter = require("../../../utils/middleware/ratelimit/auth.js");

router.get("/contacts/verify-username", ratelimiter, async (req, res) => {
  logger.info("Verify path called!")
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      logger.info("Unauthorized request: Missing or malformed Authorization header");
      return res.status(401).json({
        exists: false,
        reason: "Unauthorized: Token missing."
      });
    }

    const aToken = authHeader.split(" ")[1];
    const authorized = await verifyAccessToken(aToken);

    if (!authorized) {
      logger.info("Unauthorized request: Invalid token");
      return res.status(401).json({
        exists: false,
        reason: "User is unauthorized."
      });
    }

    const { username } = req.body;
    if (!username) {
      return res.status(400).json({
        exists: false,
        reason: "Username is required."
      });
    }

    // Ensure getRecord is awaited if it returns a Promise, and pass correct parameters
    const row = await getRecord("users", username, null, "username"); 

    if (!row) {
      logger.info("[contacts/] Username not found")
      return res.status(200).json({
        exists: false,
        reason: "Username not found."
      });
    }
  logger.info("[contacts/] Username found! ")
    return res.status(200).json({
      exists: true,
      reason: null
    });
  } catch (err) {
    logger.error("Internal server error: " + err.stack || err);
    return res.status(500).json({
      exists: false,
      reason: "Internal server error (500)"
    });
  }
});

module.exports = router;

const express = require("express");
const router = express.Router();

const logger = require("../../../utils/middleware/logger.js");
const ratelimiter = require("../../../utils/middleware/ratelimit/auth.js");
const { revokeAccessToken, revokeRefreshToken } = require("../../../utils/middleware/tokens.js");

router.post("/auth/logout", ratelimiter, async (req, res) => {
  try {
    const { aToken, rToken } = req.body;
    
    if (!aToken) {
      return res.status(400).json({
        success: false,
        reason: "Bad request: access token is not provided"
      });
    }
      
    if (!rToken) {
      return res.status(400).json({
        success: false,
        reason: "Bad request: refresh token is not provided"
      });
    }

    // Call the functions directly using the tokens provided by the client
    await Promise.all([
      revokeAccessToken(aToken),
      revokeRefreshToken(rToken)
    ]);

    return res.status(200).json({
      success: true,
      message: "Successfully logged out"
    });
    
  } catch(err) {
    logger.error("[ERROR] Internal Server Error: " + err.stack);
    
    return res.status(500).json({
      success: false,
      reason: "Internal Server Error"
    });
  }
});

module.exports = router;

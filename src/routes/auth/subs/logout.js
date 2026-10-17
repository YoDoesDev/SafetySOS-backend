const express = require("express");
const router = express.Router();

const logger = require("../../../utils/middleware/logger.js");
const ratelimiter = require("../../../utils/middleware/ratelimit/auth.js");

router.post("/auth/logout", ratelimiter, async (req, res) => {
  try {
    const { aToken, rToken } = req.body;
    
    if(!aToken)
      return res.status(400).json({
        success: false,
        reason: "Bad request: access token is not provided"
      })
      
    if(!rToken)
      return res.status(400).json({
        success: false,
        reason: "Bad request: refresh token is not provided"
      })
      
    
    
  } catch(err) {
    logger.error("[ERROR] Internal Server Error: " + err.stack);
    
    return res.status(500).json({
      success: false,
      reason: "Internal Server Error"
    })
  }
})
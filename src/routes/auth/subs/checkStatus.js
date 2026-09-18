const express = require("express");
const router = express.Router();
const logger = require("../../../utils/middleware/logger.js");

const { 
  verifyAccessToken, 
  verifyRefreshToken
} = require("../../../utils/middleware/jwtHandlers.js");

router.post("/auth/check-status", async (req, res) => {
    try {
        const { aToken, rToken } = req.body;
        
        // 1. If tokens are missing completely, cleanly reject session restoration
        if (!aToken || !rToken) {
            return res.status(200).json({
                success: false,
                reason: "Tokens missing",
                aToken: null
            });
        }
        
        // 2. Check Access Token
        const accessCheck = await verifyAccessToken(aToken);
        
        if (accessCheck.result) {
            return res.status(200).json({
                success: true, 
                reason: null, 
                aToken: null,
                rToken: null
            });
        }
        
        // 3. Access Token expired/invalid -> Check Refresh Token
        const refreshCheck = await verifyRefreshToken(rToken);
        
        if (refreshCheck.result) {
            return res.status(200).json({
                success: true, 
                reason: null, 
                aToken: refreshCheck.newAccessToken, 
                rToken: refreshCheck.newRefreshToken
            });
        }
        
        // 4. Both tokens are invalid or revoked
        return res.status(200).json({
            success: false, 
            reason: "Session expired", 
            aToken: null, 
            rToken: null
        });
        
    } catch (err) {
        logger.error("Error in /auth/check-status:", err);
        return res.status(500).json({
            success: false, 
            reason: "Internal Server Error", 
            aToken: null, 
            rToken: null
        });
    }
});

module.exports = router;

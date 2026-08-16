// DTOs BLUEPRINT:
/*
// Request sent to backend
data class RegisterOtpRequestDto(
    val username: String,
    val phone: String,
    val password: String, 
    val uid: String
)

// Response received from backend 
data class RegisterOtpResponseDto(
    val username: String,
    val phone: String,
    val passwordHash: String, 
    val uid: String, 
    val accessToken: String, 
    val refreshToken: String,
    val navigateToHome: Boolean
)
*/

const express = require("express");
const router = express.Router();
const { getRecord } = require("../../../utils/handlers/data/getRecord.js");
const { createRecord } = require("../../../utils/handlers/data/createRecord.js");
const { hashPassword, generateAccessToken, generateRefreshToken } = require("../../../utils/middleware/jwtHandlers.js");
const logger = require("../../../utils/middleware/logger.js");

router.post("/auth/register", async (req, res) => {
    const { username, phone, password, uid } = req.body;
    
    // 1. Validations
    if (!username) return res.status(400).json({ navigateToHome: false, reason: "Username field is empty" });
    if (!phone) return res.status(400).json({ navigateToHome: false, reason: "Phone field is empty" });
    if (!password) return res.status(400).json({ navigateToHome: false, reason: "Password field is empty" });
    if (!uid) return res.status(400).json({ navigateToHome: false, reason: "UID field is empty" });
    
    try {
        const hashed = await hashPassword(password);
        
        const dataObj = {
            username, 
            uid, 
            phoneNo: phone, 
            passwordHash: hashed
        };
        
        // 2. Attempt creation
        const createResult = await createRecord("users", dataObj);
        
        // 3. Handle duplicates cleanly (409 Conflict instead of 500)
        if (!createResult.result) {
            return res.status(409).json({
                navigateToHome: false,
                reason: createResult.reason || "An account with these details already exists."
            });
        }

        // 4. Fetch created user record using phone (which matches schema.keys)
        const row = await getRecord("users", phone);
        
        const payload = {
            userId: row?.uid || uid, 
            username: row?.username || username, 
            phoneNo: row?.phoneNo || phone
        };
        
        const accessToken = await generateAccessToken(payload);
        const refreshToken = await generateRefreshToken(payload);
        
        return res.status(200).json({
            username, 
            phone, 
            passwordHash: hashed, 
            uid, 
            accessToken, 
            refreshToken, 
            navigateToHome: true
        });
    
    } catch (err) {
        logger.error("Internal Error: " + err.stack);
        return res.status(500).json({
            navigateToHome: false, 
            reason: "Internal Server Error 500"
        });
    }
});

module.exports = router;
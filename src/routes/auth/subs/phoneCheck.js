const express = require("express");
const router = express.Router();
const { getRecord } = require("../../../utils/handlers/data/getRecord.js");
const logger = require("../../../utils/middleware/logger.js");

router.post("/auth/phone-check", async (req, res) => {
  try {
    const { phone } = req.body;
    
    if(!phone || typeof phone !== "string" || !phone.trim()) return res.status(400).json({
      success: false, 
      reason: "Phone field is empty."
    })
    
    const row = await getRecord("users", phone, null, "phoneNo");
    
    if(!row) return res.status(404).json({
        success: false, 
        reason: "Phone number not registered"
    })
    
    
    return res.status(200).json({
      success: true, 
      reason: "Phone number registered, OTP sent."
    })
  } catch (err) {
    return res.status(500).json({
      success: false, 
      reason: "An internal server error occurred."
    })
  }
})

module.exports = router
const express = require("express");
const router = express.Router();
const { getRecord } = require("../../../utils/handlers/data/getRecord.js")

const ratelimiter = require("../../../utils/middleware/ratelimit/auth.js");

router.post("/auth/register-check", ratelimiter, async (req, res) => {
  try{
    const { username, phone } = req.body;
  let navigateToOtp = true;
  let reason;
  
  if(!username || !phone){
    navigateToOtp = false;
    reason = "Username or phone not given.";
    return res.status(400).json({
        navigateToOtp, 
        reason
    })
  }
  
  if(await getRecord("users", username, null, "username")){
    navigateToOtp = false;
    reason = "Username already exists.";
    
    return res.status(409).json({
      navigateToOtp, 
      reason
    });
  }
  
  if(await getRecord("users", phone, null, "phoneNo")){
    navigateToOtp = false;
    reason = "Phone number already exists.";
    
    return res.status(409).json({
      navigateToOtp, 
      reason
    });
  }
  
  return res.status(200).json({
    navigateToOtp, 
    reason
  });
  } catch(err){
    logger.error("[ERROR IN REGISTER CHECK] " + err.stack);
    return res.status(500).json({
      navigateToOtp: false,
      reason: "Internal Server Error (500)"
    })
  }
});

module.exports = router;


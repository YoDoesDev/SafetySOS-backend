const express = require("express");
const router = express.Router();
const { getRecord } = require("../../../utils/handlers/data/getRecord.js")

router.post("/auth/register-check", async (req, res) => {
  const { username, phone } = req.body;
  let navigateToOtp = true;
  let reason;
  
  if(!username || !phone){
    navigateToOtp = false;
    reason = "Username already exists.";
     res.status(400).json({
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
  
  res.status(200).json({
    navigateToOtp, 
    reason
  });
});

module.exports = router;


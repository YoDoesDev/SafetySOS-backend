const express = require("express");
const router = express.Router();

router.post("/auth/register-check", (req, res) => {
  const user = req.username;
  const phone = req.phone;
  const navigateToOtp = true;
  const reason;
  
  if(getRecord("accounts", user)){
    navigateToOtp = false;
    reason = "Username already exists."
  }
  
  if(getRecord("accounts", phone)){
    navigateToOtp = false;
    reason = "Phone number already exists."
  }
  
  res.status(200).json({
    navigateToOtp, 
    reason
  })
});

module.exports = router
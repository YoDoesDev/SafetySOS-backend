const express = require("express");
const router = express.Router();

router.post("/auth/register-check", (req, res) => {
  const { username, phone } = req.body;
  let navigateToOtp = true;
  let reason;
  
  if(getRecord("accounts", username)){
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
  });
});

module.exports = router;


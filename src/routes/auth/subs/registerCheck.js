const express = require("express");
const router = express.Router();
const { getRecord } = require("../../../utils/handlers/data/getRecord.js")

router.post("/auth/register-check", async (req, res) => {
  const { username, phone } = req.body;
  let navigateToOtp = true;
  let reason;
  
  if(await getRecord("accounts", username)){
    navigateToOtp = false;
    reason = "Username already exists."
  }
  
  if(await getRecord("accounts", phone)){
    navigateToOtp = false;
    reason = "Phone number already exists."
  }
  
  res.status(200).json({
    navigateToOtp, 
    reason
  });
});

module.exports = router;


const express = require("express");
const router = express.Router();

router.post("/auth/register-check", (req, res) => {
  res.status(200).json({
    navigateToOtp = true
  })
});

module.exports = router
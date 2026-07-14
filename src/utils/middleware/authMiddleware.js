const { verifyAccessToken, verifyRefreshToken } = require("./jwtHandlers");

/**
 * Auth Middleware with Automatic Token Refresh
 * 
 * This middleware protects routes and keeps users logged in longer.
 * 
 * Flow:
 * 1. Tries to verify the Access Token first
 * 2. If access token is expired → automatically tries the Refresh Token
 * 3. If refresh token is valid → issues new tokens and continues the request
 * 
 * This way users don't get logged out every 15 minutes.
 */
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const refreshToken = req.headers["x-refresh-token"];

    // Check if access token exists
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Access token is missing",
      });
    }

    const accessToken = authHeader.split(" ")[1];

    // === Try Access Token First ===
    const accessResult = await verifyAccessToken(accessToken);

    if (accessResult.result) {
      // Access token is valid
      req.user = accessResult.payload;

      // Send new tokens if they were rotated
      if (accessResult.newAccessToken && accessResult.newRefreshToken) {
        res.setHeader("x-access-token", accessResult.newAccessToken);
        res.setHeader("x-refresh-token", accessResult.newRefreshToken);
      }

      return next(); // Continue to the route
    }

    // === Access token failed → Try Refresh Token ===
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Session expired. Please login again.",
      });
    }

    const refreshResult = await verifyRefreshToken(refreshToken);

    if (!refreshResult.result) {
      return res.status(401).json({
        success: false,
        message: "Session expired. Please login again.",
      });
    }

    // Refresh token worked → attach user and send fresh tokens
    req.user = refreshResult.payload;

    res.setHeader("x-access-token", refreshResult.newAccessToken);
    res.setHeader("x-refresh-token", refreshResult.newRefreshToken);

    next(); // Allow the request to continue

  } catch (error) {
    console.error("Auth Middleware Error:", error);
    return res.status(500).json({
      success: false,
      message: "Authentication failed",
    });
  }
};

module.exports = authMiddleware;
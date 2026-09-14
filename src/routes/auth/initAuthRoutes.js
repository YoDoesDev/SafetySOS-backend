const regCheckRoute = require("./subs/registerCheck.js");
const registerRoute = require("./subs/register.js");
const loginRoute = require("./subs/login.js");
const phoneCheckRoute = require("./subs/phoneCheck.js");
const forgotPasswordLoginRoute = require("./subs/forgotPasswordLogin.js");
const checkStatusRoute = require("./subs/checkStatus.js")

const ratelimiter = require("../../utils/middleware/ratelimit/auth.js");

const initAuthRoutes = (app) => {
  app.use("", ratelimiter, regCheckRoute);
  app.use("", ratelimiter, registerRoute);
  app.use("", ratelimiter, loginRoute);
  app.use("", ratelimiter, phoneCheckRoute);
  app.use("", ratelimiter, forgotPasswordLoginRoute);
  app.use("", checkStatusRoute);
}

module.exports = initAuthRoutes;
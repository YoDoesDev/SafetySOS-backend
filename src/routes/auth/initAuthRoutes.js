const regCheckRoute = require("./subs/registerCheck.js");
const registerRoute = require("./subs/register.js");
const loginRoute = require("./subs/login.js");
const phoneCheckRoute = require("./subs/phoneCheck.js");
const forgotPasswordLoginRoute = require("./subs/forgotPasswordLogin.js");
const checkStatusRoute = require("./subs/checkStatus.js")

const ratelimit = require("../../utils/middleware/ratelimit/auth.js")

const initAuthRoutes = (app) => {
  app.use("", ratelimit, regCheckRoute);
  app.use("", ratelimit, registerRoute);
  app.use("", ratelimit, loginRoute);
  app.use("", ratelimit, phoneCheckRoute);
  app.use("", ratelimit, forgotPasswordLoginRoute);
  app.use("", ratelimit, checkStatusRoute);
}

module.exports = initAuthRoutes;
const regCheckRoute = require("./subs/registerCheck.js");
const registerRoute = require("./subs/register.js");
const loginRoute = require("./subs/login.js");
const phoneCheckRoute = require("./subs/phoneCheck.js");
const forgotPasswordLoginRoute = require("./subs/forgotPasswordLogin.js");
const checkStatusRoute = require("./subs/checkStatus.js")

const initAuthRoutes = (app) => {
  app.use(regCheckRoute);
  app.use(registerRoute);
  app.use(loginRoute);
  app.use(phoneCheckRoute);
  app.use(forgotPasswordLoginRoute);
  app.use(checkStatusRoute);
}

module.exports = initAuthRoutes;
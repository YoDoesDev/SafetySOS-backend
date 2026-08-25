const regCheckRoute = require("./subs/registerCheck.js");
const registerRoute = require("./subs/register.js");
const loginRoute = require("./subs/login.js");
const phoneCheckRoute = require("./subs/phoneCheck.js");

const initAuthRoutes = (app) => {
  app.use("", regCheckRoute);
  app.use("", registerRoute);
  app.use("", loginRoute);
  app.use("", phoneCheckRoute)
}

module.exports = initAuthRoutes;
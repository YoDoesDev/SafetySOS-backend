const regCheckRoute = require("./subs/registerCheck.js");
const registerRoute = require("./subs/register.js");

const initAuthRoutes = (app) => {
  app.use("", regCheckRoute);
  app.use("", registerRoute);
}

module.exports = initAuthRoutes;
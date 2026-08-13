const regCheckRoute = require("./subs/registerCheck.js");

const initAuthRoutes = (app) => {
  app.use("", regCheckRoute);
}

module.exports = initAuthRoutes
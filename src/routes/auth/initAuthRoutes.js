const regCheckRoute = require("./subs/registerCheck.js");

const initAuthRoutes = () => {
  app.use("", regCheckRoute);
}
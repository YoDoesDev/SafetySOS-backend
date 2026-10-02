
const verifyUsernameRoute = require("./subs/verifyUsername.js")

const initContactRoutes = (app) => {
  app.use(verifyUsernameRoute)
}

module.exports = initContactRoutes;
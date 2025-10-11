const serverless = require("serverless-http")
const app = require("../index.js")
console.log("Loaded app for serverless")
module.exports = serverless(app)

const crypto = require("crypto")

function generateCode() {
  return crypto.randomBytes(32).toString("hex")
}

function hashCode(code) {
  return crypto.createHash("sha256").update(code).digest("hex")
}

module.exports = { generateCode, hashCode }

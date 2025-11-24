const jwt = require("jsonwebtoken")

async function validateOAuthToken(req, res, next) {
  try {
    const authHeader = req.headers["authorization"]
    const token = authHeader && authHeader.split(" ")[1]
    if (!token) return res.status(401).json({ error: "Token no proporcionado" })

    const decodedHeader = jwt.decode(token, { complete: true })
    console.log("Decoded header:", decodedHeader)

    jwt.verify(token, process.env.JWT_SECRET)
    req.user = decodedHeader
    next()
  } catch (err) {
    console.log(err)
    return res
      .status(500)
      .json({ error: "Error interno en validación de token" })
  }
}

module.exports = validateOAuthToken

const jwt = require("jsonwebtoken")
const jwksClient = require("jwks-rsa")
const fs = require("fs")
const publicKey = fs.readFileSync("./public.key", "utf8")

const client = jwksClient({
  jwksUri:
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 10 * 60 * 1000,
  rateLimit: true,
  jwksRequestsPerMinute: 10,
})

function getKey(header, callback) {
  client.getSigningKey(header.kid, function (err, key) {
    if (err) return callback(err)
    const signingKey = key.publicKey || key.rsaPublicKey
    callback(null, signingKey)
  })
}

async function validateToken(req, res, next) {
  try {
    const comesFromApi = req.baseUrl === "/api"

    const authHeader = req.headers["authorization"]
    const token = authHeader && authHeader.split(" ")[1]
    if (!token) return res.status(401).json({ error: "Token no proporcionado" })

    const decoded = jwt.decode(token, { complete: true })
    const header = decoded && decoded.header
    if (!header || !header.kid) {
      return res.status(403).json({
        error: "Token inválido",
        details: "Falta 'kid' en el header del token",
      })
    }
    jwt.verify(
      token,
      comesFromApi ? publicKey : getKey,
      {
        algorithms: ["RS256"],
        issuer: comesFromApi
          ? "spendee-back"
          : "https://securetoken.google.com/spendee-7d662",
        audience: comesFromApi ? "spendee-api" : "spendee-7d662",
      },
      (err, verifiedPayload) => {
        if (err) {
          return res
            .status(403)
            .json({ error: "Token inválido", details: err.message })
        }
        req.user = verifiedPayload
        next()
      },
    )
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Error interno en validación de token" })
  }
}

module.exports = validateToken

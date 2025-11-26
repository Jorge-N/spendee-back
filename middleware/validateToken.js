const jwt = require("jsonwebtoken")
const jwksClient = require("jwks-rsa")

const client = jwksClient({
  jwksUri:
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
  // Enable caching so we don't fetch the JWKS on every request.
  cache: true,
  // Keep a small number of keys in memory.
  cacheMaxEntries: 5,
  // Cache keys for 10 minutes (in ms) - adjust as needed for your environment.
  cacheMaxAge: 10 * 60 * 1000,
  // Prevent hammering the JWKS endpoint under high load.
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
    const authHeader = req.headers["authorization"]
    const token = authHeader && authHeader.split(" ")[1]
    if (!token) return res.status(401).json({ error: "Token no proporcionado" })

    // Decode the token header to ensure it contains a `kid` before attempting verification.
    const decoded = jwt.decode(token, { complete: true })
    const header = decoded && decoded.header
    if (!header || !header.kid) {
      return res
        .status(403)
        .json({ error: "Token inválido", details: "Falta 'kid' en el header del token" })
    }
    jwt.verify(
      token,
      getKey,
      {
        algorithms: ["RS256"],
        issuer: "https://securetoken.google.com/spendee-7d662",
        audience: "spendee-7d662",
      },
      (err, verifiedPayload) => {
        if (err) {
          return res.status(403).json({ error: "Token inválido", details: err.message })
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

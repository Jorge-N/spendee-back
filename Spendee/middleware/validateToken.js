const jwt = require("jsonwebtoken")
const jwksClient = require("jwks-rsa")

// JWKS client pointing to Firebase securetoken JWKs
const client = jwksClient({
  jwksUri:
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
})

function getKey(header, callback) {
  // Obtain the signing key from JWKS
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

    // Optional: decode for debug
    try {
      const decoded = jwt.decode(token, { complete: true })
      // eslint-disable-next-line no-console
      console.log("JWT decoded payload:", decoded?.payload)
    } catch (e) {
      // ignore
    }

    jwt.verify(
      token,
      getKey,
      {
        algorithms: ["RS256"],
        issuer: "https://securetoken.google.com/spendee-7d662",
        audience: "spendee-7d662",
      },
      (err, decoded) => {
        if (err) {
          return res
            .status(403)
            .json({ error: "Token inválido", details: err.message })
        }
        req.usuario = decoded
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

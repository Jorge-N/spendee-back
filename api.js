const express = require("express")
const router = express.Router()
const { PrismaClient } = require("@prisma/client")
const truncateToDate = require("./helpers/truncateToDate")
const validateOAuthToken = require("./middleware/validateOAuthToken")
const validateToken = require("./middleware/validateToken")

const prisma = new PrismaClient()

// Public login route: authenticate email/password against Firebase
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {}
    console.log("Login attempt for email:", email)
    console.log(
      "FIREBASE_API_KEY:",
      process.env.FIREBASE_API_KEY ? "present" : "missing",
    )
    if (!email || !password)
      return res.status(400).json({ error: "Missing email or password" })

    const apiKey = process.env.FIREBASE_API_KEY
    if (!apiKey)
      return res
        .status(500)
        .json({ error: "Server misconfiguration: FIREBASE_API_KEY missing" })

    const resp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      },
    )

    const data = await resp.json()
    if (!resp.ok)
      return res.status(401).json({
        error: data.error?.message || "Authentication failed",
        details: data,
      })

    const { idToken, refreshToken, expiresIn, localId: uid, displayName } = data

    // Reconcile user in Prisma (find by id or email)
    const existing = await prisma.usuario
      .findFirst({ where: { OR: [{ id: uid }, { email }] } })
      .catch(() => null)
    let usuario
    if (existing) {
      const where =
        existing.id === uid ? { id: uid } : { email: existing.email }
      usuario = await prisma.usuario.update({
        where,
        data: { nombre: displayName || existing.nombre, email },
      })
    } else {
      usuario = await prisma.usuario.create({
        data: { id: uid, nombre: displayName || "", email, isDeveloper: false },
      })
    }

    res.json({
      idToken,
      refreshToken,
      expiresIn,
      uid,
      usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email },
    })
  } catch (err) {
    console.error("Login error:", err)
    res.status(500).json({ error: "Internal server error during login" })
  }
})

// --- OAuth2 backend flow for Google (server-side) ---
// This lets external apps redirect users to this backend so the backend
// performs the OAuth exchange (client_secret stays on the server).

// Temporary in-memory state store: state -> { redirectUri, expiresAt }
const oauthStateStore = new Map()
// cleanup expired states periodically
setInterval(() => {
  const now = Date.now()
  for (const [k, v] of oauthStateStore.entries())
    if (v.expiresAt < now) oauthStateStore.delete(k)
}, 60 * 1000)

// Step 1: redirect user to Google's consent screen
router.get("/oauth/google", (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const redirectUri =
    process.env.OAUTH_REDIRECT_URI ||
    `${req.protocol}://${req.get("host")}/api/oauth/google/callback`
  console.log(req.query)
  const frontendRedirect = req.query.redirect_uri // where to send user after flow

  if (!clientId)
    return res
      .status(500)
      .send("Server misconfiguration: GOOGLE_CLIENT_ID missing")
  // Require the caller to provide a client redirect_uri so we know where to send the user back
  if (!frontendRedirect)
    return res.status(400).send("Missing redirect_uri query param")

  // Validate the provided redirect_uri is a well-formed absolute URL
  try {
    new URL(String(frontendRedirect))
  } catch (e) {
    return res.status(400).send("Invalid redirect_uri")
  }

  // Optional whitelist: a comma-separated list of allowed client redirect URIs or origins
  const allowedCsv = process.env.ALLOWED_OAUTH_REDIRECT_URIS || ""
  const allowed = allowedCsv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  if (allowed.length) {
    const ok = allowed.some((a) => {
      // allow exact match or same origin (origin ends with a)
      try {
        const provided = new URL(String(frontendRedirect))
        const allowedUrl = new URL(a)
        return (
          provided.origin === allowedUrl.origin &&
          (allowedUrl.pathname === "/" ||
            provided.pathname.startsWith(allowedUrl.pathname))
        )
      } catch (e) {
        return false
      }
    })
    if (!ok) return res.status(400).send("redirect_uri not allowed")
  }

  const state = require("crypto").randomBytes(16).toString("hex")
  oauthStateStore.set(state, {
    redirectUri: String(frontendRedirect),
    expiresAt: Date.now() + 5 * 60 * 1000,
  })

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth")
  authUrl.searchParams.set("client_id", clientId)
  authUrl.searchParams.set("redirect_uri", redirectUri)
  authUrl.searchParams.set("response_type", "code")
  authUrl.searchParams.set("scope", "openid email profile")
  authUrl.searchParams.set("access_type", "offline")
  authUrl.searchParams.set("prompt", "consent")
  authUrl.searchParams.set("state", state)

  res.redirect(authUrl.toString())
})

// Step 2: callback from Google with code -> exchange for tokens and upsert user
router.get("/oauth/google/callback", async (req, res) => {
  try {
    const { code, state } = req.query
    if (!code || !state) return res.status(400).send("Missing code or state")

    console.log("OAuth callback received code and state", state, code)

    const stored = oauthStateStore.get(state)
    console.log("Retrieved stored state for", state, stored)
    oauthStateStore.delete(state)
    if (!stored) return res.status(400).send("Invalid or expired state")

    // If for some reason the original request didn't include a redirectUri we stored,
    // fail with a clear message instead of throwing when building the URL.
    if (!stored.redirectUri) {
      console.error(
        "OAuth state had no redirectUri; state:",
        state,
        "stored:",
        stored,
      )
      return res
        .status(400)
        .send("Missing original redirect_uri; cannot continue")
    }

    const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: String(code),
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        redirect_uri:
          process.env.OAUTH_REDIRECT_URI ||
          `${req.protocol}://${req.get("host")}/api/oauth/google/callback`,
        grant_type: "authorization_code",
      }),
    })

    const tokenData = await tokenResp.json()
    if (!tokenResp.ok) {
      console.error("Token exchange failed", tokenData)
      return res
        .status(400)
        .json({ error: "Token exchange failed", details: tokenData })
    }

    // tokenData contains access_token, id_token, refresh_token, expires_in
    const {
      id_token: idToken,
      access_token: accessToken,
      refresh_token: refreshToken,
    } = tokenData

    // Verify id_token using Google's tokeninfo endpoint
    const infoResp = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
    )
    const info = await infoResp.json()
    if (!infoResp.ok) {
      console.error("id_token verification failed", info)
      return res.status(400).json({ error: "Invalid id_token", details: info })
    }

    const uid = info.sub
    const email = info.email
    const nombre = info.name || info.given_name || ""

    console.log("OAuth verified user:", uid, email, nombre)

    // Upsert user in Prisma (same logic as other routes)
    const existing = await prisma.usuario
      .findFirst({ where: { OR: [{ id: uid }, { email }] } })
      .catch(() => null)
    let usuario
    if (existing) {
      const where =
        existing.id === uid ? { id: uid } : { email: existing.email }
      usuario = await prisma.usuario.update({
        where,
        data: { nombre: nombre || existing.nombre, email },
      })
    } else {
      usuario = await prisma.usuario.create({
        data: { id: uid, nombre: nombre || "", email, isDeveloper: false },
      })
    }
    console.log("stored redirectUri:", stored.redirectUri)
    // By default redirect back to the client provided in initial request, attaching id_token as fragment
    // Note: attaching tokens in URL has risks; consider server-to-server delivery for production.
    let redirectToClient
    try {
      redirectToClient = new URL(stored.redirectUri)
    } catch (e) {
      console.error("Invalid stored.redirectUri:", stored.redirectUri, e)
      return res.status(400).send("Stored redirect_uri is invalid")
    }
    // send minimal user info and id_token
    redirectToClient.hash = new URLSearchParams({
      idToken,
      uid,
      email,
    }).toString()
    return res.redirect(redirectToClient.toString())
  } catch (err) {
    console.error("OAuth callback error", err)
    res.status(500).send("Internal server error")
  }
})

// Create gasto
router.post("/gasto", validateOAuthToken, async (req, res) => {
  const { gasto, categoryName } = req.body
  const userId = req.user.payload.sub

  if (gasto == null || isNaN(Number(gasto))) {
    return res.status(400).json({ error: "Missing or invalid gasto amount" })
  }

  try {
    //busqueda o creacion de categoria
    let categoria = await prisma.categorias.findFirst({
      where: {
        nombre: categoryName,
        usuarioId: userId,
      },
    })

    let categoriaId
    if (!categoria) {
      categoria = await prisma.categorias.create({
        data: {
          nombre: categoryName,
          usuarioId: userId,
        },
      })
    }
    categoriaId = categoria.id

    const gastoSum = await prisma.gasto.aggregate({
      where: { usuarioId: userId },
      _sum: { gasto: true },
    })
    const ingresoSum = await prisma.ingreso.aggregate({
      where: { usuarioId: userId },
      _sum: { ingreso: true },
    })

    const sumaGastos = gastoSum._sum.gasto
      ? parseFloat(gastoSum._sum.gasto.toString())
      : 0
    const sumaIngresos = ingresoSum._sum.ingreso
      ? parseFloat(ingresoSum._sum.ingreso.toString())
      : 0

    const montoAnterior = sumaIngresos - sumaGastos

    const nuevoGasto = await prisma.gasto.create({
      data: {
        usuarioId: userId,
        gasto: Number(gasto),
        montoAnterior,
        fecha: new Date(),
        categoriaId: categoriaId != null ? parseInt(categoriaId) : 7, //7 = otros
      },
    })

    res.status(201).json(nuevoGasto)
  } catch (error) {
    console.error("API POST /gasto error:", error)
    res.status(400).json({ error: error.message })
  }
})

router.get("/gastos", validateToken, async (req, res) => {
  console.log(req.user)
  try {
    const { month, year, categoryName, limit = 100, order = "asc" } = req.query
    const userId = req.user.uid

    //busqueda categoria
    let categoria = await prisma.categorias.findFirst({
      where: {
        nombre: categoryName,
        usuarioId: userId,
      },
    })

    let categoryId
    if (!categoria) {
      //devolver error si no existe la categoria
      return res.status(400).json({ error: "Categoria no encontrada" })
    }
    categoryId = categoria.id

    const filters = {
      where: {
        usuarioId: userId,
        ...(categoryId && { categoriaId: parseInt(categoryId) }),
        ...(month &&
          year && {
            fecha: {
              gte: new Date(Number(year), Number(month) - 1, 1),
              lt: new Date(Number(year), Number(month), 1),
            },
          }),
      },
      orderBy: { fecha: order === "desc" ? "desc" : "asc" },
      ...(limit && { take: parseInt(limit) }),
    }

    const gastos = await prisma.gasto.findMany(filters)
    res.json(gastos)
  } catch (error) {
    console.error("API /gasto error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// Ingresos
router.post("/ingreso", validateToken, async (req, res) => {
  const { ingreso } = req.body
  const userId = req.user.uid
  try {
    const gastoSum = await prisma.gasto.aggregate({
      where: { usuarioId: userId },
      _sum: { gasto: true },
    })
    const ingresoSum = await prisma.ingreso.aggregate({
      where: { usuarioId: userId },
      _sum: { ingreso: true },
    })

    const sumaGastos = gastoSum._sum.gasto
      ? parseFloat(gastoSum._sum.gasto.toString())
      : 0
    const sumaIngresos = ingresoSum._sum.ingreso
      ? parseFloat(ingresoSum._sum.ingreso.toString())
      : 0

    const montoAnterior = sumaIngresos - sumaGastos

    const nuevoIngreso = await prisma.ingreso.create({
      data: { usuarioId: userId, ingreso, montoAnterior, fecha: new Date() },
    })
    res.status(201).json(nuevoIngreso)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

router.get("/ingresos", validateToken, async (req, res) => {
  try {
    const { month, year, limit = 100, order = "asc" } = req.query
    const userId = req.user.uid
    const filters = {
      where: {
        usuarioId: userId,
        ...(month &&
          year && {
            fecha: {
              gte: new Date(Number(year), Number(month) - 1, 1),
              lt: new Date(Number(year), Number(month), 1),
            },
          }),
      },
      orderBy: { fecha: order === "desc" ? "desc" : "asc" },
      ...(limit && { take: parseInt(limit) }),
    }
    const ingresos = await prisma.ingreso.findMany(filters)
    res.json(ingresos)
  } catch (error) {
    console.error("API /ingreso error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// Get balance aggregated by month (simple version)
router.get("/balance", validateToken, async (req, res) => {
  try {
    const { startDate, endDate, order = "asc" } = req.query
    const userId = req.user.uid

    const start = startDate ? new Date(startDate) : new Date("1970-01-01")
    const end = endDate ? new Date(endDate) : new Date()

    const expenses = await prisma.gasto.findMany({
      where: { usuarioId: userId, fecha: { gte: start, lte: end } },
      select: { gasto: true, fecha: true },
    })

    const incomes = await prisma.ingreso.findMany({
      where: { usuarioId: userId, fecha: { gte: start, lte: end } },
      select: { ingreso: true, fecha: true },
    })

    const formattedExpenses = expenses.map((e) => ({
      monto: Number(e.gasto),
      fecha: e.fecha,
      tipo: "expense",
      period: e.fecha.toISOString().slice(0, 7),
    }))
    const formattedIncomes = incomes.map((i) => ({
      monto: Number(i.ingreso),
      fecha: i.fecha,
      tipo: "income",
      period: i.fecha.toISOString().slice(0, 7),
    }))

    const all = [...formattedExpenses, ...formattedIncomes].sort(
      (a, b) => new Date(a.fecha) - new Date(b.fecha),
    )

    const grouped = Object.values(
      all.reduce((acc, mov) => {
        const { period, tipo, monto } = mov
        if (!acc[period])
          acc[period] = { period, items: [], totalEgresos: 0, totalIngresos: 0 }
        acc[period].items.push(mov)
        if (tipo === "income") acc[period].totalIngresos += monto
        if (tipo === "expense") acc[period].totalEgresos += monto
        return acc
      }, {}),
    )

    const result = grouped.sort((a, b) =>
      order === "desc"
        ? b.period.localeCompare(a.period)
        : a.period.localeCompare(b.period),
    )
    res.json(result)
  } catch (error) {
    console.error("API /balance error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// Categories
router.get("/categories", validateToken, async (req, res) => {
  try {
    const uid = req.user.uid
    const categorias = await prisma.categorias.findMany({
      where: { OR: [{ usuarioId: "0" }, { usuarioId: uid }] },
    })
    res.json(categorias)
  } catch (error) {
    console.error("API /categories error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

module.exports = router

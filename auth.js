const express = require("express")
const router = express.Router()
const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()


// Public login route: authenticate email/password against Firebase
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {}
    console.log('Login attempt for email:', email)
    console.log('FIREBASE_API_KEY:', process.env.FIREBASE_API_KEY ? 'present' : 'missing')
    if (!email || !password) return res.status(400).json({ error: 'Missing email or password' })

    const apiKey = process.env.FIREBASE_API_KEY
    if (!apiKey) return res.status(500).json({ error: 'Server misconfiguration: FIREBASE_API_KEY missing' })

    const resp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    })

    const data = await resp.json()
    if (!resp.ok) return res.status(401).json({ error: data.error?.message || 'Authentication failed', details: data })

    const { idToken, refreshToken, expiresIn, localId: uid, displayName } = data

    // Reconcile user in Prisma (find by id or email)
    const existing = await prisma.usuario.findFirst({ where: { OR: [{ id: uid }, { email }] } }).catch(() => null)
    let usuario
    if (existing) {
      const where = existing.id === uid ? { id: uid } : { email: existing.email }
      usuario = await prisma.usuario.update({ where, data: { nombre: displayName || existing.nombre, email } })
    } else {
      usuario = await prisma.usuario.create({ data: { id: uid, nombre: displayName || '', email, isDeveloper: false } })
    }

    res.json({ idToken, refreshToken, expiresIn, uid, usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email } })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: 'Internal server error during login' })
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
  for (const [k, v] of oauthStateStore.entries()) if (v.expiresAt < now) oauthStateStore.delete(k)
}, 60 * 1000)

// Step 1: redirect user to Google's consent screen
router.get('/oauth/google', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const redirectUri = process.env.OAUTH_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/oauth/google/callback`
  console.log (req.query)
  const frontendRedirect = req.query.redirect_uri // where to send user after flow

  if (!clientId) return res.status(500).send('Server misconfiguration: GOOGLE_CLIENT_ID missing')
  // Require the caller to provide a client redirect_uri so we know where to send the user back
  if (!frontendRedirect) return res.status(400).send('Missing redirect_uri query param')

  // Validate the provided redirect_uri is a well-formed absolute URL
  try {
    new URL(String(frontendRedirect))
  } catch (e) {
    return res.status(400).send('Invalid redirect_uri')
  }

  // Optional whitelist: a comma-separated list of allowed client redirect URIs or origins
  const allowedCsv = process.env.ALLOWED_OAUTH_REDIRECT_URIS || ''
  const allowed = allowedCsv.split(',').map((s) => s.trim()).filter(Boolean)
  if (allowed.length) {
    const ok = allowed.some((a) => {
      // allow exact match or same origin (origin ends with a)
      try {
        const provided = new URL(String(frontendRedirect))
        const allowedUrl = new URL(a)
        return provided.origin === allowedUrl.origin && (allowedUrl.pathname === '/' || provided.pathname.startsWith(allowedUrl.pathname))
      } catch (e) {
        return false
      }
    })
    if (!ok) return res.status(400).send('redirect_uri not allowed')
  }

  const state = require('crypto').randomBytes(16).toString('hex')
  oauthStateStore.set(state, { redirectUri: String(frontendRedirect), expiresAt: Date.now() + 5 * 60 * 1000 })

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', 'openid email profile')
  authUrl.searchParams.set('access_type', 'offline')
  authUrl.searchParams.set('prompt', 'consent')
  authUrl.searchParams.set('state', state)

  res.redirect(authUrl.toString())
})

// Step 2: callback from Google with code -> exchange for tokens and upsert user
router.get('/oauth/google/callback', async (req, res) => {
  try {
    const { code, state } = req.query
    if (!code || !state) return res.status(400).send('Missing code or state')
    
    console.log('OAuth callback received code and state', state, code)

    const stored = oauthStateStore.get(state)
    console.log('Retrieved stored state for', state, stored)
    oauthStateStore.delete(state)
    if (!stored) return res.status(400).send('Invalid or expired state')

    // If for some reason the original request didn't include a redirectUri we stored,
    // fail with a clear message instead of throwing when building the URL.
    if (!stored.redirectUri) {
      console.error('OAuth state had no redirectUri; state:', state, 'stored:', stored)
      return res.status(400).send('Missing original redirect_uri; cannot continue')
    }

    const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: String(code),
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        redirect_uri: process.env.OAUTH_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/oauth/google/callback`,
        grant_type: 'authorization_code',
      }),
    })

    const tokenData = await tokenResp.json()
    if (!tokenResp.ok) {
      console.error('Token exchange failed', tokenData)
      return res.status(400).json({ error: 'Token exchange failed', details: tokenData })
    }

    // tokenData contains access_token, id_token, refresh_token, expires_in
    const { id_token: idToken, access_token: accessToken, refresh_token: refreshToken } = tokenData

    // Verify id_token using Google's tokeninfo endpoint
    const infoResp = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`)
    const info = await infoResp.json()
    if (!infoResp.ok) {
      console.error('id_token verification failed', info)
      return res.status(400).json({ error: 'Invalid id_token', details: info })
    }

    const uid = info.sub
    const email = info.email
    const nombre = info.name || info.given_name || ''

    console.log('OAuth verified user:', uid, email, nombre)

    // Upsert user in Prisma (same logic as other routes)
    const existing = await prisma.usuario.findFirst({ where: { OR: [{ id: uid }, { email }] } }).catch(() => null)
    let usuario
    if (existing) {
      const where = existing.id === uid ? { id: uid } : { email: existing.email }
      usuario = await prisma.usuario.update({ where, data: { nombre: nombre || existing.nombre, email } })
    } else {
      usuario = await prisma.usuario.create({ data: { id: uid, nombre: nombre || '', email, isDeveloper: false } })
    }
    console.log('stored redirectUri:', stored.redirectUri)
    // By default redirect back to the client provided in initial request, attaching id_token as fragment
    // Note: attaching tokens in URL has risks; consider server-to-server delivery for production.
    let redirectToClient
    try {
      redirectToClient = new URL(stored.redirectUri)
    } catch (e) {
      console.error('Invalid stored.redirectUri:', stored.redirectUri, e)
      return res.status(400).send('Stored redirect_uri is invalid')
    }
    // send minimal user info and id_token
    redirectToClient.hash = new URLSearchParams({ idToken, uid, email }).toString()
    return res.redirect(redirectToClient.toString())
  } catch (err) {
    console.error('OAuth callback error', err)
    res.status(500).send('Internal server error')
  }
})

module.exports = router
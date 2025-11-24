const express = require("express")
const router = express.Router()
const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()
const jwt = require("jsonwebtoken")

const { generateCode, hashCode } = require("../utils/oauth")
const { generateRefreshToken, hashRefreshToken } = require("../utils/refresh")

const JWT_SECRET = process.env.JWT_SECRET

router.post("/code", async (req, res) => {
  try {
    const { userId } = req.body

    if (!userId) {
      return res.status(400).json({ error: "Missing userId" })
    }

    const code = generateCode()
    const codeHash = hashCode(code)

    await prisma.oAuthCode.create({
      data: {
        codeHash,
        userId,
        expiresAt: new Date(Date.now() + 30 * 1000),
      },
    })

    const redirect = `https://estaller.vschiaffino.com/profile?code=${code}`
    return res.json({ redirect })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: "Server error" })
  }
})

router.post("/token", async (req, res) => {
  try {
    const { code } = req.body

    if (!code) {
      return res.status(400).json({ error: "Missing code" })
    }

    const codeHash = hashCode(code)

    const record = await prisma.oAuthCode.findFirst({
      where: { codeHash },
    })

    if (!record) return res.status(400).json({ error: "Invalid code" })
    if (record.used) return res.status(400).json({ error: "Code already used" })
    if (record.expiresAt < new Date()) {
      return res.status(400).json({ error: "Code expired" })
    }

    await prisma.oAuthCode.update({
      where: { id: record.id },
      data: { used: true },
    })

    const accessToken = jwt.sign({ sub: record.userId }, JWT_SECRET, {
      expiresIn: "1h",
    })

    const refreshToken = generateRefreshToken()
    const refreshHash = hashRefreshToken(refreshToken)

    await prisma.refreshToken.create({
      data: {
        tokenHash: refreshHash,
        userId: record.userId,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días
      },
    })

    return res.json({
      token_type: "Bearer",
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 3600,
    })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: "Server error" })
  }
})

router.post("/refresh", async (req, res) => {
  try {
    const { refresh_token } = req.body

    if (!refresh_token) {
      return res.status(400).json({ error: "Missing refresh_token" })
    }

    const refreshHash = hashRefreshToken(refresh_token)

    const stored = await prisma.refreshToken.findFirst({
      where: {
        tokenHash: refreshHash,
        revoked: false,
      },
    })

    if (!stored) return res.status(400).json({ error: "Invalid refresh token" })
    if (stored.expiresAt < new Date())
      return res.status(400).json({ error: "Refresh token expired" })

    const newAccess = jwt.sign({ sub: stored.userId }, JWT_SECRET, {
      expiresIn: "1h",
    })

    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revoked: true },
    })

    const newRefresh = generateRefreshToken()
    const newRefreshHash = hashRefreshToken(newRefresh)

    await prisma.refreshToken.create({
      data: {
        tokenHash: newRefreshHash,
        userId: stored.userId,
        expiresAt: new Date(Date.now() + 30 * 86400 * 1000),
      },
    })

    return res.json({
      token_type: "Bearer",
      access_token: newAccess,
      refresh_token: newRefresh,
      expires_in: 3600,
    })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: "Server error" })
  }
})

module.exports = router

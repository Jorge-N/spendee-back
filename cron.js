// cron.js
const express = require("express")
const router = express.Router()
const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()

function verifyCronToken(req, res, next) {
  const token = req.headers.authorization
  if (!token || token !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" })
  }
  next()
}

router.post("/update-rachas", verifyCronToken, async (req, res) => {
  try {
    const now = new Date()

    const ayer = new Date(now)
    ayer.setDate(ayer.getDate() - 1)
    ayer.setHours(0, 0, 0, 0)

    const anteayer = new Date(now)
    anteayer.setDate(anteayer.getDate() - 2)
    anteayer.setHours(0, 0, 0, 0)

    await prisma.racha.updateMany({
      where: {
        ultimaFecha: {
          gte: ayer,
          lt: new Date(ayer.getTime() + 24 * 60 * 60 * 1000),
        },
      },
      data: {
        isInactive: true,
      },
    })

    await prisma.racha.updateMany({
      where: {
        ultimaFecha: {
          gte: anteayer,
          lt: new Date(anteayer.getTime() + 24 * 60 * 60 * 1000),
        },
      },
      data: {
        rachaActual: 0,
      },
    })

    res.json({ message: "Rachas actualizadas correctamente" })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error actualizando rachas" })
  }
})

module.exports = router

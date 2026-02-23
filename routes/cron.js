// cron.js
const express = require("express")
const router = express.Router()
const { PrismaClient } = require("@prisma/client")
const truncateToDate = require("../helpers/truncateToDate.js")

const prisma = new PrismaClient()

function verifyCronToken(req, res, next) {
  const token = req.headers.authorization
  if (!token || token !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" })
  }
  next()
}

router.get("/", verifyCronToken, (req, res) => {
  res.json({ message: "Cron endpoint is working" })
})

router.post("/update-rachas", verifyCronToken, async (req, res) => {
  try {
    const now = new Date()
    const nowAR = new Date(now.getTime() - 3 * 60 * 60 * 1000)
    const ayer = new Date(nowAR)
    ayer.setDate(ayer.getUTCDate() - 1)
    ayer.setHours(-3, 0, 0, 0)

    const anteayer = new Date(nowAR)
    anteayer.setDate(anteayer.getUTCDate() - 2)
    anteayer.setHours(-3, 0, 0, 0)
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
        isInactive: true,
      },
    })

    res.json({
      message: "Rachas actualizadas correctamente",
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error actualizando rachas" })
  }
})

module.exports = router

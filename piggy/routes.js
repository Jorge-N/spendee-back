const express = require("express")
const router = express.Router()
const { PrismaClient } = require("@prisma/client")
const { getRandomObjectives } = require("../helpers/getRandomObjectives")

const prisma = new PrismaClient()

router.get("/", async (req, res) => {
  const userId = req.user?.uid
  const randomObjectives = await getRandomObjectives(3)
  try {
    const piggy = await prisma.piggy.upsert({
      where: { usuarioId: userId },
      update: {},
      create: {
        usuarioId: userId,
        objetivos: {
          create: randomObjectives.map((o) => ({
            objetivoId: o.id,
          })),
        },
      },
      include: {
        objetivos: { include: { objetivo: true } },
      },
    })
    res.status(200).json(piggy)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

module.exports = router

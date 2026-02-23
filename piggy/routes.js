const express = require("express")
const router = express.Router()
const { PrismaClient } = require("@prisma/client")
const getRandomObjectives = require("../helpers/getRandomObjectives")
const validateToken = require("../middleware/validateToken")

const prisma = new PrismaClient()

router.get("/", validateToken, async (req, res) => {
  const userId = req.user.user_id
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized: No user ID found" })
  }
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

router.put("/updatePiggy", validateToken, async (req, res) => {
  const userId = req.user.user_id
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized: No user ID found" })
  }
  const { nombre } = req.body
  try {
    const updatedPiggy = await prisma.piggy.updateMany({
      where: { usuarioId: userId },
      data: { nombre },
    })
    res.status(200).json(updatedPiggy)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

router.get("/checkObjective", validateToken, async (req, res) => {
  const userId = req.user.user_id
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized: No user ID found" })
  }
  const { action } = req.query

  if (!action) {
    return res.status(400).json({ error: "Action is required" })
  }

  try {
    const piggy = await prisma.piggy.findUnique({
      where: { usuarioId: userId },
      include: {
        objetivos: {
          include: { objetivo: true },
        },
      },
    })

    if (!piggy) {
      return res.status(404).json({ error: "Piggy not found" })
    }

    const objetivosAActualizar = piggy.objetivos.filter(
      (obj) => obj.objetivo.accion === action,
    )

    if (objetivosAActualizar.length === 0) {
      return res.status(200).json({ updated: false })
    }

    const updates = []

    for (const obj of objetivosAActualizar) {
      const nuevoProgreso = obj.progreso + 1
      const completado = nuevoProgreso >= obj.objetivo.maxProgreso

      updates.push(
        prisma.objetivoUsuario.update({
          where: { id: obj.id },
          data: {
            progreso: nuevoProgreso,
          },
        }),
      )

      if (completado) {
        updates.push(
          prisma.piggy.update({
            where: { id: piggy.id },
            data: {
              xp: piggy.xp + 1,
            },
          }),
        )

        updates.push(
          prisma.objetivoUsuario.delete({
            where: { id: obj.id },
          }),
        )

        const [nuevoObjetivo] = await getRandomObjectives(
          1,
          piggy.objetivos.map((o) => o.objetivoId),
        )
        updates.push(
          prisma.objetivoUsuario.create({
            data: {
              piggyId: piggy.id,
              objetivoId: nuevoObjetivo.id,
            },
          }),
        )
      }
    }

    await prisma.$transaction(updates)

    return res.status(200).json({ updated: true })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: error.message })
  }
})

router.put("/updateAvatar", validateToken, async (req, res) => {
  const userId = req.user.user_id
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized: No user ID found" })
  }
  const { avatarId } = req.body
  try {
    const updatedPiggy = await prisma.piggy.update({
      where: { usuarioId: userId },
      data: { avatarId },
    })
    res.status(200).json(updatedPiggy)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

module.exports = router

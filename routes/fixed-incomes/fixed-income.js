const express = require("express")
const router = express.Router()
const { PrismaClient } = require("@prisma/client")
const validateToken = require("../../middleware/validateToken.js")

const prisma = new PrismaClient()

router.post("/create", validateToken, async (req, res) => {
  const { ingreso, frecuencia } = req.body

  try {
    const nuevoIngresoFijo = await prisma.ingresoFijo.create({
      data: {
        usuarioId: req.user.user_id,
        ingreso: Number(ingreso),
        frecuencia: frecuencia,
      },
    })
    res.status(201).json(nuevoIngresoFijo)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

router.get("/", validateToken, async (req, res) => {
  try {
    const ingresosFijos = await prisma.ingresoFijo.findMany({
      where: { usuarioId: req.user.user_id },
    })
    res.status(200).json(ingresosFijos)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

router.get("/:id", validateToken, async (req, res) => {
  const id = parseInt(req.params.id)
  try {
    const ingresoFijo = await prisma.ingresoFijo.findUnique({
      where: { id: id, usuarioId: req.user.user_id },
    })
    if (!ingresoFijo)
      return res.status(404).json({ error: "Gasto no encontrado" })
    res.status(200).json(ingresoFijo)
  } catch (error) {
    res.status(400).json({ error: error })
  }
})

router.patch("/:id", validateToken, async (req, res) => {
  const { ingreso, frecuencia } = req.body
  const id = parseInt(req.params.id)
  try {
    await prisma.ingresoFijo.update({
      where: { id: id, usuarioId: req.user.user_id },
      data: {
        ingreso: Number(ingreso),
        frecuencia: frecuencia,
      },
    })
    res.status(200).json({ message: "Ingreso fijo actualizado con éxito" })
  } catch (error) {
    res.status(400).json({ error: error })
  }
})

router.delete("/:id", validateToken, async (req, res) => {
  const id = parseInt(req.params.id)
  try {
    const ingresoFijoEliminado = await prisma.ingresoFijo.delete({
      where: { id: id, usuarioId: req.user.user_id },
    })
    res
      .status(200)
      .json({ message: "Ingreso fijo eliminado", ingresoFijoEliminado })
  } catch (error) {
    res.status(400).json({ error: error })
  }
})

module.exports = router

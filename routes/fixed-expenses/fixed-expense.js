const express = require("express")
const router = express.Router()
const { PrismaClient } = require("@prisma/client")
const validateToken = require("../../middleware/validateToken.js")

const prisma = new PrismaClient()

router.post("/create", validateToken, async (req, res) => {
  const { nombre, gasto, diaDeVencimiento, metodoPago, categoriaId } = req.body

  try {
    const nuevoGastoFijo = await prisma.gastoFijo.create({
      data: {
        usuarioId: req.user.user_id,
        nombre: nombre,
        gasto: gasto,
        diaDeVencimiento: diaDeVencimiento,
        metodoPago: metodoPago,
        categoriaId: categoriaId,
      },
    })
    res.status(201).json(nuevoGastoFijo)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

router.get("/", validateToken, async (req, res) => {
  try {
    const gastosFijos = await prisma.gastoFijo.findMany()
    res.status(200).json(gastosFijos)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

router.get("/:id", validateToken, async (req, res) => {
  const id = parseInt(req.params.id)
  try {
    const gastoFijo = await prisma.gastoFijo.findUnique({
      where: { id: id, usuarioId: req.user.user_id },
    })
    if (!gastoFijo)
      return res.status(404).json({ error: "Gasto no encontrado" })
    res.status(200).json(gastoFijo)
  } catch (error) {
    res.status(400).json({ error: error })
  }
})

router.patch("/:id", validateToken, async (req, res) => {
  const { nombre, gasto, diaDeVencimiento, metodoPago, categoriaId } = req.body
  const id = parseInt(req.params.id)
  try {
    await prisma.gastoFijo.update({
      where: { id: id, usuarioId: req.user.user_id },
      data: {
        nombre: nombre,
        gasto: gasto,
        diaDeVencimiento: diaDeVencimiento,
        metodoPago: metodoPago,
        categoriaId: categoriaId,
      },
    })
    res.status(200).json({ message: "Gasto fijo actualizado con éxito" })
  } catch (error) {
    res.status(400).json({ error: error })
  }
})

router.delete("/:id", validateToken, async (req, res) => {
  const id = parseInt(req.params.id)
  try {
    const gastoFijoEliminado = await prisma.gastoFijo.delete({
      where: { id: id, usuarioId: req.user.user_id },
    })
    res
      .status(200)
      .json({ message: "Gasto fijo eliminado", gastoFijoEliminado })
  } catch (error) {
    res.status(400).json({ error: error })
  }
})

module.exports = router

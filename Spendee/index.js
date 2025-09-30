import express from "express"
import { PrismaClient } from "@prisma/client"
import { validateToken } from "./middleware/validateToken.js"

const app = express()
const prisma = new PrismaClient()

app.use(express.json())

// JWT validation moved to middleware/validateToken.js

app.get("/", (req, res) => {
  res.send("API de Gestión de Gastos")
})

// Endpoint de prueba para debug del JWT
app.get("/test-jwt", validateToken, (req, res) => {
  res.json({
    message: "JWT válido!",
    usuario: req.usuario,
  })
})

// Ruta protegida para crear un gasto
app.post("/gasto", validateToken, async (req, res) => {
  const { userId, gasto, montoAnterior } = req.body
  try {
    const nuevoGasto = await prisma.gasto.create({
      data: {
        usuarioId: userId,
        gasto,
        montoAnterior,
        fecha: new Date(),
      },
    })
    res.status(201).json(nuevoGasto)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// Ruta para obtener todos los gastos
app.get("/gasto", validateToken, async (req, res) => {
  const gastos = await prisma.gasto.findMany()
  res.json(gastos)
})

app.post("/ingreso", validateToken, async (req, res) => {
  const { userId, ingreso, montoAnterior } = req.body
  try {
    const nuevoIngreso = await prisma.ingreso.create({
      data: {
        usuarioId: userId,
        ingreso,
        montoAnterior,
        fecha: new Date(),
      },
    })
    res.status(201).json(nuevoIngreso)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// Ruta para obtener todos los ingresos
app.get("/ingreso", validateToken, async (req, res) => {
  const ingresos = await prisma.ingreso.findMany()
  res.json(ingresos)
})

app.get("/balance/:userId", validateToken, async (req, res) => {
  const { userId } = req.params
  try {
    const gastos = await prisma.gasto.findMany({
      where: { usuarioId: userId },
    })
    const sumaGastos = gastos.reduce((total, gasto) => total + gasto.gasto, 0)
    const ingresos = await prisma.ingreso.findMany({
      where: { usuarioId: userId },
    })
    const sumaIngresos = ingresos.reduce(
      (total, ingreso) => total + ingreso.ingreso,
      0,
    )
    const balance = sumaIngresos - sumaGastos
    res.json({ balance, sumaIngresos, sumaGastos })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.get("/categories", async (req, res) => {
  const categories = await prisma.CategoriasDefault.findMany()
  res.json(categories)
})

app.post("/customCategory", validateToken, async (req, res) => {
  const { nombre, icono, color, descripcion } = req.body
  try {
    const nuevaCategoria = await prisma.customCategories.create({
      data: {
        nombre,
        icono,
        color,
        descripcion,
      },
    })
    res.status(201).json(nuevaCategoria)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// Ruta para obtener todas las categorías personalizadas
app.get("/customCategories", validateToken, async (req, res) => {
  const categorias = await prisma.customCategories.findMany()
  res.json(categorias)
})

//ruta para obtener todos los gastos de un usuario por categoría
//recibe user y categoryId por query params
app.post("/gastosPorCategoria", validateToken, async (req, res) => {
  const { userId, categoryId } = req.body
  try {
    const gastos = await prisma.gasto.findMany({
      where: {
        usuarioId: userId,
        categoriaId: parseInt(categoryId),
      },
    })
    res.json(gastos)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

export default app

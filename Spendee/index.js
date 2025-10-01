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

app.post("/customCategory", validateToken, async (req, res) => {
  const { nombre, icono, color, descripcion } = req.body
  try {
    const uid = req.usuario?.sub || req.usuario?.user_id || req.usuario?.uid
    const nuevaCategoria = await prisma.customCategories.create({
      data: {
        usuarioId: uid,
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

// Ruta que devuelve todas las categorías (por defecto + custom del usuario)
// - Las categorías por defecto no son editables (editable: false)
// - Las categorías custom del usuario sí lo son (editable: true)
// Esta ruta requiere JWT para poder obtener las categorías custom del usuario.
app.get("/categories", validateToken, async (req, res) => {
  try {
    // Obtener categorías por defecto (globales)
    const defaultCategories = await prisma.categoriasDefault.findMany()

    // Extraer user id desde el token o query param - soportamos varias claves comunes
    const uid = req.usuario?.sub || req.usuario?.user_id || req.usuario?.uid || req.query.userId

    // Obtener categorias custom del usuario (si existe uid)
    const customCategories = uid
      ? await prisma.customCategories.findMany({ where: { usuarioId: uid } })
      : []

    // Calcular sumas de gastos por categoriaId para el usuario (una sola consulta)
    let sumsByCategoria = new Map()
    console.log("User ID for category sums:", uid)
    if (uid) {
      const sums = await prisma.gasto.groupBy({
        by: ["categoriaId"],
        where: {
          usuarioId: uid,
          categoriaId: { not: null },
        },
        _sum: {
          gasto: true,
        },
      })
      console.log("Sums by categoriaId:", sums)
      for (const s of sums) {
        // s.categoriaId puede ser null, lo ignoramos
        sumsByCategoria.set(s.categoriaId, s._sum?.gasto ?? 0)
      }
    }

    // Normalizar y añadir flag editable + totalGastos
    const normalizedDefaults = defaultCategories.map((c) => ({
      id: c.id,
      categoria: c.categoria,
      icono: c.icono,
      color: c.color,
      descripcion: c.descripcion,
      editable: false,
      source: 'default',
      totalGastos: sumsByCategoria.get(c.id) ?? 0,
    }))

    const normalizedCustom = customCategories.map((c) => ({
      id: c.id,
      categoria: c.categoria || c.nombre || null,
      icono: c.icono,
      color: c.color,
      descripcion: c.descripcion,
      editable: true,
      source: 'custom',
      // Actualmente los gastos están asociados solo a CategoriasDefault (categoriaId FK),
      // por eso aquí devolvemos 0. Si en el futuro enlazas gastos con customCategories,
      // será necesario actualizar este cálculo.
      totalGastos: 0,
    }))

    res.json([...normalizedDefaults, ...normalizedCustom])
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
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

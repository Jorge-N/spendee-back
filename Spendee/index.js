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

app.get("/gasto/:userId", validateToken, async (req, res) => {
  const { userId } = req.params
  try {
    const userExpenses = await prisma.gasto.findMany({
      where: { usuarioId: userId },
    })
    res.status(200).json(userExpenses)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.get("/gastoPorId/:id", validateToken, async (req, res) => {
  const id = parseInt(req.params.id)
  if (isNaN(id)) {
    return res.status(400).json({ error: "ID inválido" })
  }

  try {
    const expense = await prisma.gasto.findUnique({
      where: { id },
    })
    if (!expense) return res.status(404).json({ error: "Gasto no encontrado" })
    res.status(200).json(expense)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
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
  const { categoria, icono, color, descripcion } = req.body
  try {
    const uid = req.usuario?.sub || req.usuario?.user_id || req.usuario?.uid
    const nuevaCategoria = await prisma.customCategories.create({
      data: {
        usuarioId: uid,
        categoria,
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
    const uid =
      req.usuario?.sub ||
      req.usuario?.user_id ||
      req.usuario?.uid ||
      req.query.userId

    // Obtener categorias custom del usuario (si existe uid)
    const customCategories = uid
      ? await prisma.customCategories.findMany({ where: { usuarioId: uid } })
      : []

    // Calcular sumas de gastos por categoriaId para el usuario (una sola consulta)
    let sumsByCategoria = new Map()
    let sumByCustom = new Map()
    console.log("User ID for category sums:", uid)
    if (uid) {
      const sumsDefault = await prisma.gasto.groupBy({
        by: ["categoriaId"],
        where: {
          usuarioId: uid,
          categoriaId: { not: null },
        },
        _sum: {
          gasto: true,
        },
      })
      const sumsCustom = await prisma.gasto.groupBy({
        by: ["customCategoriaId"],
        where: {
          usuarioId: uid,
          customCategoriaId: { not: null },
        },
        _sum: {
          gasto: true,
        },
      })
      console.log("Sums by customCategoriaId:", sumsCustom)
      console.log("Sums by categoriaId:", sumsDefault)
      for (const s of sumsDefault) {
        sumsByCategoria.set(s.categoriaId, s._sum?.gasto ?? 0)
      }
      for (const s of sumsCustom) {
        sumByCustom.set(s.customCategoriaId, s._sum?.gasto ?? 0)
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
      source: "default",
      totalGastos: sumsByCategoria.get(c.id) ?? 0,
    }))

    const normalizedCustom = customCategories.map((c) => ({
      id: c.id,
      categoria: c.categoria || c.nombre || null,
      icono: c.icono,
      color: c.color,
      descripcion: c.descripcion,
      editable: true,
      source: "custom",
      // Actualmente los gastos están asociados solo a CategoriasDefault (categoriaId FK),
      // por eso aquí devolvemos 0. Si en el futuro enlazas gastos con customCategories,
      // será necesario actualizar este cálculo.
      totalGastos: sumByCustom.get(c.id) ?? 0,
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

app.delete("/deleteCategory/:id", validateToken, async (req, res) => {
  console.log("Back")
  const { id } = req.params
  try {
    const uid = req.usuario?.sub || req.usuario?.user_id || req.usuario?.uid

    const category = await prisma.customCategories.findUnique({
      where: { id: Number(id) },
    })

    if (!category) {
      return res.status(404).json({ message: "Categoría no encontrada" })
    }

    if (category.usuarioId !== uid) {
      return res
        .status(403)
        .json({ message: "No tenés permiso para eliminar esta categoría" })
    }

    const deletedCategory = await prisma.customCategories.delete({
      where: { id: Number(id) },
    })

    res.status(200).json({
      message: "Categoría eliminada correctamente",
      deletedCategory,
    })
  } catch (error) {
    console.error("Error eliminando categoría:", error)
    res
      .status(500)
      .json({ message: "Error eliminando categoría", error: error.message })
  }
})

app.put("/modifyCategory/:id", validateToken, async (req, res) => {
  console.log("Modificando categoría...")
  const { id } = req.params
  const { categoria, descripcion, icono, color } = req.body

  try {
    const uid = req.usuario?.sub || req.usuario?.user_id || req.usuario?.uid
    const categoriaExistente = await prisma.customCategories.findUnique({
      where: { id: parseInt(id) },
    })

    if (!categoriaExistente) {
      return res.status(404).json({ error: "Categoría no encontrada" })
    }
    if (categoriaExistente.usuarioId !== uid) {
      return res
        .status(403)
        .json({ error: "No tenés permiso para modificar esta categoría" })
    }
    const categoriaActualizada = await prisma.customCategories.update({
      where: { id: parseInt(id) },
      data: {
        categoria: categoria || categoriaExistente.categoria,
        descripcion: descripcion || categoriaExistente.descripcion,
        icono: icono || categoriaExistente.icono,
        color: color || categoriaExistente.color,
      },
    })

    res.json({
      message: "Categoría modificada correctamente",
      categoria: categoriaActualizada,
    })
  } catch (error) {
    console.error("Error modificando categoría:", error)
    res.status(500).json({ error: error.message })
  }
})

export default app

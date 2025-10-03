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
  const { userId, gasto, montoAnterior, categoriaId, customCategoriaId } =
    req.body
  try {
    const nuevoGasto = await prisma.gasto.create({
      data: {
        usuarioId: userId,
        gasto,
        montoAnterior,
        fecha: new Date(),
        customCategoriaId: customCategoriaId ? customCategoriaId : null,
        categoriaId: categoriaId,
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
  const { nombre, icono, color, descripcion } = req.body
  try {
    const uid = req.usuario?.sub || req.usuario?.user_id || req.usuario?.uid
    const nuevaCategoria = await prisma.categorias.create({
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

app.get("/categories", validateToken, async (req, res) => {
  try {
    const uid =
      req.usuario?.sub ||
      req.usuario?.user_id ||
      req.usuario?.uid ||
      req.query.userId

    const categorias = await prisma.categorias.findMany({
      where: { OR: [{ usuarioId: "0" }, { usuarioId: uid }] },
    })
    let sumGastos = new Map()
    if (uid) {
      const sums = await prisma.gasto.groupBy({
        by: ["categoriaId"],
        where: {
          usuarioId: uid,
        },
        _sum: {
          gasto: true,
        },
      })
      for (const s of sums) {
        sumGastos.set(s.categoriaId, s._sum?.gasto ?? 0)
      }
    }
    const categoriasConGastos = categorias.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      icono: c.icono,
      color: c.color,
      descripcion: c.descripcion,
      totalGastos: sumGastos.get(c.id) || 0,
    }))
    res.json(categoriasConGastos)
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
  const { id } = req.params
  try {
    const uid = req.usuario?.sub || req.usuario?.user_id || req.usuario?.uid

    const category = await prisma.categorias.findUnique({
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
    const categoriaExistente = await prisma.categorias.findUnique({
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
        nombre: categoria || categoriaExistente.categoria,
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

const serverless = require("serverless-http")
const express = require("express")
const validateToken = require("./middleware/validateToken.js")
const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()
const app = express()

app.use(express.json())

app.get("/", (req, res) => {
  res.status(200).send("Spendee API is running")
})

app.get("/gasto", validateToken, async (req, res) => {
  const gastos = await prisma.gasto.findMany()
  res.json(gastos)
})

app.get("/test-jwt", validateToken, (req, res) => {
  res.json({
    message: "JWT válido!",
    usuario: req.usuario,
  })
})

app.post("/gasto", validateToken, async (req, res) => {
  const { userId, gasto, montoAnterior, categoriaId } = req.body
  try {
    const nuevoGasto = await prisma.gasto.create({
      data: {
        usuarioId: userId,
        gasto,
        montoAnterior,
        fecha: new Date(),
        categoriaId: categoriaId,
      },
    })
    res.status(201).json(nuevoGasto)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.get("/gasto", validateToken, async (req, res) => {
  const gastos = await prisma.gasto.findMany()
  res.json(gastos)
})

app.get("/gasto/:userId", validateToken, async (req, res) => {
  const { userId } = req.params
  const { limit: limitRaw, order: orderRaw } = req.query

  const orderDir =
    String(orderRaw || "desc").toLowerCase() === "asc" ? "asc" : "desc"

  let take
  if (limitRaw === undefined) {
    take = 10
  } else if (String(limitRaw).toLowerCase() === "all") {
    take = undefined
  } else {
    const parsed = parseInt(limitRaw, 10)
    take = Number.isNaN(parsed) || parsed <= 0 ? 10 : parsed
  }

  try {
    const query = {
      where: { usuarioId: userId },
      orderBy: { fecha: orderDir },
    }
    if (take !== undefined) query.take = take

    const userExpenses = await prisma.gasto.findMany(query)
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

app.delete("/gasto/:id", validateToken, async (req, res) => {
  const id = parseInt(req.params.id)
  if (isNaN(id)) {
    return res.status(400).json({ error: "ID inválido" })
  }

  try {
    const deletedExpense = await prisma.gasto.delete({
      where: { id },
    })
    res
      .status(200)
      .json({ message: "Gasto eliminado correctamente", deletedExpense })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.put("/moverGastosCategoria", validateToken, async (req, res) => {
  const { categoriaOrigenId, categoriaDestinoId } = req.body
  try {
    const uid = req.usuario?.sub || req.usuario?.user_id || req.usuario?.uid
    if (!categoriaOrigenId || !categoriaDestinoId) {
      return res
        .status(400)
        .json({ error: "Debes indicar las categorías origen y destino." })
    }
    const [origen, destino] = await Promise.all([
      prisma.categorias.findFirst({
        where: { id: parseInt(categoriaOrigenId), usuarioId: uid },
      }),
      prisma.categorias.findFirst({
        where: { id: parseInt(categoriaDestinoId) },
      }),
    ])
    if (!origen) {
      return res
        .status(404)
        .json({ error: "La categoría de origen no existe o no te pertenece." })
    }
    if (!destino) {
      return res
        .status(404)
        .json({ error: "La categoría de destino no existe o no te pertenece." })
    }
    const resultado = await prisma.gasto.updateMany({
      where: {
        usuarioId: uid,
        categoriaId: parseInt(categoriaOrigenId),
      },
      data: {
        categoriaId: parseInt(categoriaDestinoId),
      },
    })

    res.status(200).json({
      message: `Se movieron ${resultado.count} gastos de la categoría ${origen.nombre} a ${destino.nombre}.`,
      cantidad: resultado.count,
    })
  } catch (error) {
    console.error("Error moviendo gastos de categoría:", error)
    res.status(500).json({ error: "" })
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

app.get("/ingreso", validateToken, async (req, res) => {
  const ingresos = await prisma.ingreso.findMany()
  res.json(ingresos)
})

app.get("/ingresoPorId/:id", validateToken, async (req, res) => {
  const id = parseInt(req.params.id)
  if (isNaN(id)) {
    return res.status(400).json({ error: "ID inválido" })
  }

  try {
    const income = await prisma.ingreso.findUnique({
      where: { id },
    })
    if (!income) return res.status(404).json({ error: "Ingreso no encontrado" })
    res.status(200).json(income)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.get("/ingreso/:userId", validateToken, async (req, res) => {
  const { userId } = req.params
  try {
    const userIncomes = await prisma.ingreso.findMany({
      where: { usuarioId: userId },
    })
    res.status(200).json(userIncomes)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.get("/balance/:userId", validateToken, async (req, res) => {
  const { userId } = req.params
  try {
    const gastoSum = await prisma.gasto.aggregate({
      where: { usuarioId: userId },
      _sum: { gasto: true },
    })

    const ingresoSum = await prisma.ingreso.aggregate({
      where: { usuarioId: userId },
      _sum: { ingreso: true },
    })

    const sumaGastos = gastoSum._sum.gasto
      ? parseFloat(gastoSum._sum.gasto.toString())
      : 0
    const sumaIngresos = ingresoSum._sum.ingreso
      ? parseFloat(ingresoSum._sum.ingreso.toString())
      : 0

    const balance = sumaIngresos - sumaGastos
    res.json({ balance, sumaIngresos, sumaGastos })
  } catch (error) {
    console.error(error)
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
  const { month, year } = req.query
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
      // Construir filtro de fechas opcional si se provee month and/or year
      const dateFilter = {}
      const m = month ? parseInt(month, 10) : undefined
      const y = year ? parseInt(year, 10) : undefined

      if ((!isNaN(m) && m >= 1 && m <= 12) || !isNaN(y)) {
        // Si se da month sin year, asumimos el año actual
        const now = new Date()
        const yy = !isNaN(y) ? y : now.getFullYear()

        if (!isNaN(m) && m >= 1 && m <= 12) {
          // Filtrar por mes específico
          const start = new Date(yy, m - 1, 1)
          const end = new Date(yy, m, 1) // primer día del siguiente mes
          dateFilter.fecha = { gte: start, lt: end }
        } else {
          // Solo año: filtrar todo el año
          const start = new Date(yy, 0, 1)
          const end = new Date(yy + 1, 0, 1)
          dateFilter.fecha = { gte: start, lt: end }
        }
      }

      const sums = await prisma.gasto.groupBy({
        by: ["categoriaId"],
        where: Object.assign({ usuarioId: uid }, dateFilter),
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
      editable: c.editable,
    }))
    res.json(categoriasConGastos)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.get("/gastosPorCategoria", validateToken, async (req, res) => {
  const { userId, categoryId } = req.query
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

    const deletedCategory = await prisma.categorias.delete({
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
    // usar el modelo correcto (`categorias`) y los campos reales (nombre)
    const categoriaActualizada = await prisma.categorias.update({
      where: { id: parseInt(id) },
      data: {
        nombre: categoria || categoriaExistente.nombre,
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

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`)
})

module.exports = serverless(app)

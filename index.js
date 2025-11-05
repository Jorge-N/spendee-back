const serverless = require("serverless-http")
const express = require("express")
const truncateToDate = require("./helpers/truncateToDate.js")
const validateToken = require("./middleware/validateToken.js")
const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()
const app = express()

app.use(express.json())

app.get("/", (req, res) => {
  res.status(200).send("Spendee API is running")
})

app.get("/test-jwt", validateToken, (req, res) => {
  res.json({
    message: "JWT válido!",
    usuario: req.usuario,
  })
})

app.post("/gasto", validateToken, async (req, res) => {
  const { usuarioId, gasto, montoAnterior, categoriaId } = req.body
  try {
    const nuevoGasto = await prisma.gasto.create({
      data: {
        usuarioId: usuarioId,
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
  try {
    const { userId, month, year, categoryId, limit, order = "asc" } = req.query

    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ error: "Missing or invalid userId" })
    }

    const filters = {
      where: {
        usuarioId: userId,
        ...(categoryId && { categoriaId: parseInt(categoryId) }),
        ...(month &&
          year && {
            fecha: {
              gte: new Date(Number(year), Number(month) - 1, 1),
              lt: new Date(Number(year), Number(month), 1),
            },
          }),
      },
      orderBy: {
        fecha: order === "desc" ? "desc" : "asc",
      },
      ...(limit && { take: parseInt(limit) }),
    }

    const gastos = await prisma.gasto.findMany(filters)
    res.json(gastos)
  } catch (error) {
    console.error("Error fetching gastos:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

app.get("/gasto/agrupado", validateToken, async (req, res) => {
  try {
    const { userId } = req.query

    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ error: "Missing or invalid userId" })
    }

    const groupedExpenses = await prisma.$queryRaw`
      SELECT 
        TO_CHAR("fecha", 'YYYY-MM') AS month,
        json_agg(
          json_build_object(
            'id', "id",
            'usuarioId', "usuarioId",
            'gasto', "gasto",
            'fecha', "fecha",
            'montoAnterior', "montoAnterior",
            'categoriaId', "categoriaId"
          )
          ORDER BY "fecha" DESC
        ) AS items
      FROM "Gasto"
      WHERE "usuarioId" = ${userId}
      GROUP BY month
      ORDER BY month DESC;
    `

    res.json(groupedExpenses)
  } catch (error) {
    console.error("Error grouping expenses:", error)
    res.status(500).json({ error: "Internal server error" })
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

app.put("/gastoPorId/:id", validateToken, async (req, res) => {
  const id = parseInt(req.params.id)
  const { toCategoryId } = req.body
  const toCategoryIdInt = parseInt(toCategoryId)

  if (isNaN(id)) {
    return res.status(400).json({ error: "ID inválido" })
  }

  try {
    await prisma.gasto.update({
      where: { id },
      data: { categoriaId: toCategoryIdInt },
    })
    res.status(200).json({ message: "Categoría del gasto actualizada" })
  } catch (error) {
    console.log(error)
    res.status(400).json({ message: "Error al extraer categorias o gasto" })
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
  try {
    const { userId, month, year, limit, order = "asc" } = req.query

    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ error: "Missing or invalid userId" })
    }

    const filters = {
      where: {
        usuarioId: userId,
        ...(month &&
          year && {
            fecha: {
              gte: new Date(Number(year), Number(month) - 1, 1),
              lt: new Date(Number(year), Number(month), 1),
            },
          }),
      },
      orderBy: {
        fecha: order === "desc" ? "desc" : "asc",
      },
      ...(limit && { take: parseInt(limit) }),
    }

    const ingresos = await prisma.ingreso.findMany(filters)
    res.json(ingresos)
  } catch (error) {
    console.error("Error fetching ingresos:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

app.get("/ingreso/agrupado", validateToken, async (req, res) => {
  try {
    const { userId } = req.query

    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ error: "Missing or invalid userId" })
    }

    const groupedIncomes = await prisma.$queryRaw`
      SELECT 
        TO_CHAR("fecha", 'YYYY-MM') AS month,
        json_agg(
          json_build_object(
            'id', "id",
            'usuarioId', "usuarioId",
            'ingreso', "ingreso",
            'montoAnterior', "montoAnterior",
            'fecha', "fecha"
          )
          ORDER BY "fecha" DESC
        ) AS items
      FROM "Ingreso"
      WHERE "usuarioId" = ${userId}
      GROUP BY month
      ORDER BY month DESC;
    `

    res.json(groupedIncomes)
  } catch (error) {
    console.error("Error grouping ingresos:", error)
    res.status(500).json({ error: "Internal server error" })
  }
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

app.get("/balance/agrupado", validateToken, async (req, res) => {
  try {
    const {
      userId,
      startDate,
      endDate,
      groupBy = "month",
      order = "asc",
    } = req.query

    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ error: "Missing or invalid userId" })
    }

    const start = startDate ? new Date(startDate) : new Date("1970-01-01")
    const end = endDate ? new Date(endDate) : new Date()

    let format
    switch (groupBy) {
      case "day":
        format = "YYYY-MM-DD"
        break
      case "year":
        format = "YYYY"
        break
      case "month":
      default:
        format = "YYYY-MM"
        break
    }

    const expenses = await prisma.gasto.findMany({
      where: {
        usuarioId: userId,
        fecha: {
          gte: start,
          lte: end,
        },
      },
      select: {
        id: true,
        usuarioId: true,
        gasto: true,
        fecha: true,
        montoAnterior: true,
        categoriaId: true,
      },
    })

    const incomes = await prisma.ingreso.findMany({
      where: {
        usuarioId: userId,
        fecha: {
          gte: start,
          lte: end,
        },
      },
      select: {
        id: true,
        usuarioId: true,
        ingreso: true,
        fecha: true,
        montoAnterior: true,
      },
    })

    const formattedExpenses = expenses.map((e) => ({
      id: e.id,
      usuarioId: e.usuarioId,
      monto: Number(e.gasto),
      fecha: e.fecha,
      tipo: "expense",
      categoriaId: e.categoriaId,
      period: e.fecha.toISOString().slice(0, 7),
    }))

    const formattedIncomes = incomes.map((i) => ({
      id: i.id,
      usuarioId: i.usuarioId,
      monto: Number(i.ingreso),
      fecha: i.fecha,
      tipo: "income",
      categoriaId: null,
      period: i.fecha.toISOString().slice(0, 7),
    }))

    const allMovements = [...formattedExpenses, ...formattedIncomes].sort(
      (a, b) => {
        const diff = new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
        return order === "desc" ? -diff : diff
      },
    )

    const grouped = Object.values(
      allMovements.reduce((acc, mov) => {
        const { period, tipo, monto } = mov

        if (!acc[period]) {
          acc[period] = {
            period,
            items: [],
            totalEgresos: 0,
            totalIngresos: 0,
          }
        }

        acc[period].items.push(mov)

        if (tipo === "income") acc[period].totalIngresos += monto
        if (tipo === "expense") acc[period].totalEgresos += monto

        return acc
      }, {}),
    )

    const result = grouped.sort((a, b) =>
      order === "desc"
        ? b.period.localeCompare(a.period)
        : a.period.localeCompare(b.period),
    )

    res.json(result)
  } catch (error) {
    console.error("Error agrupando movimientos:", error)
    res.status(500).json({ error: "Internal server error" })
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

app.get("/budgets", async (req, res) => {
  try {
    const { usuarioId } = req.query
    if (!usuarioId) {
      return res.status(400).json({ error: "Falta el usuarioId" })
    }
    const now = truncateToDate(new Date())
    const [futureBudgets, currentBudget, pastBudgets] = await Promise.all([
      prisma.presupuesto.findMany({
        where: {
          usuarioId,
          fechaInicio: { gt: now },
        },
        include: {
          PresupuestoCategoria: {
            include: { categoria: true },
          },
        },
        orderBy: { fechaInicio: "asc" },
      }),
      prisma.presupuesto.findFirst({
        where: {
          usuarioId,
          fechaInicio: { lte: now },
          fechaFin: { gte: now },
        },
        include: {
          PresupuestoCategoria: {
            include: { categoria: true },
          },
        },
      }),
      prisma.presupuesto.findMany({
        where: {
          usuarioId,
          fechaFin: { lt: now },
        },
        include: {
          PresupuestoCategoria: {
            include: { categoria: true },
          },
        },
      }),
    ])

    if (currentBudget) {
      const gastosPorCategoria = await prisma.gasto.groupBy({
        by: ["categoriaId"],
        _sum: { gasto: true },
        where: {
          usuarioId,
          fecha: {
            gte: currentBudget.fechaInicio,
            lte: currentBudget.fechaFin,
          },
        },
      })

      const gastosMap = gastosPorCategoria.reduce((acc, g) => {
        acc[g.categoriaId] = g._sum.gasto ?? 0
        return acc
      }, {})

      currentBudget.PresupuestoCategoria =
        currentBudget.PresupuestoCategoria.map((presCat) => {
          const gastado = gastosMap[presCat.categoriaId] || 0
          const porcentaje = Math.min((gastado / presCat.monto) * 100, 100)
          return {
            ...presCat,
            gastado,
            porcentaje,
          }
        })
    }
    const allBudgets = [
      ...pastBudgets,
      ...(currentBudget ? [currentBudget] : []),
      ...futureBudgets,
    ]
    const allBudgetDates = allBudgets.flatMap((budget) => {
      const fechas = []
      const start = new Date(budget.fechaInicio)
      const end = new Date(budget.fechaFin)
      const current = new Date(start)

      while (current <= end) {
        fechas.push(new Date(current))
        current.setDate(current.getDate() + 1)
      }

      return fechas
    })
    console.log("Fechas de todos los presupuestos:", allBudgetDates)
    return res.json({
      futureBudgets,
      currentBudget,
      pastBudgets,
      allBudgetDates,
    })
  } catch (error) {
    console.error("Error al obtener presupuestos:", error)
    res.status(500).json({ error: "Error interno del servidor" })
  }
})

app.post("/budget", validateToken, async (req, res) => {
  const { usuarioId, monto, fechaInicio, fechaFin, PresupuestoCategoria } =
    req.body

  const fechaInicioT = truncateToDate(fechaInicio)
  const fechaFinT = truncateToDate(fechaFin)
  try {
    const newBudget = await prisma.presupuesto.create({
      data: {
        usuarioId,
        monto: monto,
        fechaInicio: fechaInicioT,
        fechaFin: fechaFinT,
        PresupuestoCategoria: {
          create: PresupuestoCategoria.map((cat) => ({
            categoriaId: cat.categoriaId,
            monto: cat.monto,
          })),
        },
      },
    })
    res.status(201).json(newBudget)
  } catch (error) {
    console.error("Error creando presupuesto:", error)
    res.status(400).json({ error: error.message })
  }
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`)
})

module.exports = serverless(app)
module.exports = app

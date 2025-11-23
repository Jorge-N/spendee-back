const serverless = require("serverless-http")
const express = require("express")
const truncateToDate = require("./helpers/truncateToDate.js")
const validateToken = require("./middleware/validateToken.js")
const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()
const app = express()

app.use(express.json())

// Mount API routes protected by APISecret (x-api-key + x-api-user-id)
const apiRouter = require("./routes/api.js")
app.use("/api", apiRouter)

const authRouter = require("./routes/auth.js")
app.use("/auth", authRouter)

const cron = require("./routes/cron.js")
app.use("/cron", cron)

const levelsRouter = require("./routes/levels/levels.js")
app.use("/levels", levelsRouter)

const expenseRouter = require("./routes/expenses/expense.js")
app.use("/expense", expenseRouter)

const categoryRouter = require("./routes/category/category.js")
app.use("/categories", categoryRouter)

const incomesRouter = require("./routes/incomes/incomes.js")
app.use("/income", incomesRouter)

app.get("/", (req, res) => {
  res.status(200).send("Spendee API is running")
})

app.get("/test-jwt", validateToken, (req, res) => {
  res.json({
    message: "JWT válido!",
    usuario: req.usuario,
  })
})




/* 
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
*/

app.get("/balance/agrupado", validateToken, async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      groupBy = "month",
      order = "asc",
    } = req.query

    const userId  = req.user.user_id

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

app.get("/budgets", validateToken, async (req, res) => {
  console.log("Obteniendo presupuestos para usuario:", req.user.user_id)
  try {
    const  usuarioId  = req.user.user_id
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
        orderBy: { fechaInicio: "asc" },
      }),
    ])

    const calcularGastos = async (presupuesto) => {
      const gastosPorCategoria = await prisma.gasto.groupBy({
        by: ["categoriaId"],
        _sum: { gasto: true },
        where: {
          usuarioId,
          fecha: {
            gte: presupuesto.fechaInicio,
            lte: presupuesto.fechaFin,
          },
        },
      })

      const gastosMap = gastosPorCategoria.reduce((acc, g) => {
        acc[g.categoriaId] = g._sum.gasto ?? 0
        return acc
      }, {})

      const categoriasConGasto = presupuesto.PresupuestoCategoria.map(
        (presCat) => {
          const gastado = gastosMap[presCat.categoriaId] || 0
          const porcentaje = (gastado / presCat.monto) * 100
          return {
            ...presCat,
            gastado,
            porcentaje,
          }
        },
      )

      return {
        ...presupuesto,
        PresupuestoCategoria: categoriasConGasto,
      }
    }

    const pastBudgetsConDatos = await Promise.all(
      pastBudgets.map(calcularGastos),
    )

    const currentBudgetConDatos = currentBudget
      ? await calcularGastos(currentBudget)
      : null

    const futureBudgetsConDatos = await Promise.all(
      futureBudgets.map(calcularGastos),
    )

    const allBudgets = [
      ...pastBudgetsConDatos,
      ...(currentBudgetConDatos ? [currentBudgetConDatos] : []),
      ...futureBudgetsConDatos,
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
    return res.json({
      futureBudgets: futureBudgetsConDatos,
      currentBudget: currentBudgetConDatos,
      pastBudgets: pastBudgetsConDatos,
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

app.delete("/budget/:id", validateToken, async (req, res) => {
  const { id } = req.params
  try {
    const deletedPresupuestoCategorias =
      await prisma.presupuestoCategoria.deleteMany({
        where: { presupuestoId: parseInt(id) },
      })
    const deletedBudget = await prisma.presupuesto.delete({
      where: { id: parseInt(id) },
    })
    res
      .status(200)
      .json({ message: "Presupuesto eliminado correctamente", deletedBudget })
  } catch (error) {
    console.error("Error eliminando presupuesto:", error)
    res.status(400).json({ error: error.message })
  }
})

app.put("/budget/:id", validateToken, async (req, res) => {
  const { id } = req.params
  const { monto, fechaInicio, fechaFin, PresupuestoCategoria } = req.body

  try {
    const updatedBudget = await prisma.presupuesto.update({
      where: { id: parseInt(id) },
      data: {
        monto,
        fechaInicio: new Date(fechaInicio),
        fechaFin: new Date(fechaFin),
      },
    })

    await prisma.presupuestoCategoria.deleteMany({
      where: { presupuestoId: parseInt(id) },
    })

    if (PresupuestoCategoria?.length) {
      await prisma.presupuestoCategoria.createMany({
        data: PresupuestoCategoria.map((cat) => ({
          presupuestoId: parseInt(id),
          categoriaId: cat.categoriaId,
          monto: cat.monto,
        })),
      })
    }

    res
      .status(200)
      .json({ message: "Presupuesto actualizado correctamente", updatedBudget })
  } catch (error) {
    console.error("Error actualizando presupuesto:", error)
    res.status(400).json({ error: error.message })
  }
})

app.get("/budget/:budgetId", validateToken, async (req, res) => {
  const { budgetId } = req.params
  try {
    const budget = await prisma.presupuesto.findUnique({
      where: { id: parseInt(budgetId) },
      include: {
        PresupuestoCategoria: {
          include: { categoria: true },
        },
      },
    })

    if (!budget) {
      return res.status(404).json({ error: "Presupuesto no encontrado" })
    }

    const gastosPorCategoria = await prisma.gasto.groupBy({
      by: ["categoriaId"],
      _sum: { gasto: true },
      where: {
        usuarioId: budget.usuarioId,
        fecha: {
          gte: budget.fechaInicio,
          lte: budget.fechaFin,
        },
      },
    })

    const gastosMap = gastosPorCategoria.reduce((acc, g) => {
      acc[g.categoriaId] = g._sum.gasto ?? 0
      return acc
    }, {})

    const categoriasConGasto = budget.PresupuestoCategoria.map((presCat) => {
      const gastado = gastosMap[presCat.categoriaId] || 0
      const porcentaje = presCat.monto > 0 ? (gastado / presCat.monto) * 100 : 0
      return {
        ...presCat,
        gastado,
        porcentaje,
      }
    })

    const budgetConDatos = {
      ...budget,
      PresupuestoCategoria: categoriasConGasto,
    }

    res.status(200).json(budgetConDatos)
  } catch (error) {
    console.error("Error obteniendo presupuesto:", error)
    res.status(400).json({ error: error.message })
  }
})

//get API ID
app.get("/getApiId", validateToken, async (req, res) => {
  const uid = req.user?.sub || req.user?.user_id || req.user?.uid
  console.log("Obteniendo API User ID:", uid)
  res.json({ apiId: uid })
})

//Generar API Secret
app.post("/generateApiSecret", validateToken, async (req, res) => {
  // Extraer identificadores desde el token (compatible con distintos claim names de Firebase)
  const uid = req.usuario?.sub || req.usuario?.user_id || req.usuario?.uid
  const email = req.usuario?.email
  const nombre = req.usuario?.name || req.usuario?.displayName || ""

  if (!uid) {
    return res.status(400).json({
      error: "No se pudo obtener el identificador del usuario del token",
    })
  }

  const crypto = require("crypto")

  try {
    const apiSecret = crypto.randomBytes(32).toString("hex")
    const salt = crypto.randomBytes(16).toString("hex")
    const derivedKey = crypto.scryptSync(apiSecret, salt, 64).toString("hex")
    const storedValue = `${salt}:${derivedKey}`

    const existingUser = await prisma.usuario.findUnique({
      where: { id: uid },
    })

    if (existingUser) {
      await prisma.usuario.update({
        where: { id: uid },
        data: { APISecret: storedValue },
      })
    } else {
      const emailToStore = email
      await prisma.usuario.create({
        data: {
          id: uid,
          nombre: nombre || "",
          email: emailToStore,
          isDeveloper: true,
          APISecret: storedValue,
        },
      })
    }

    // Devolver el secret en texto plano al usuario
    res.json({ apiSecret })
  } catch (error) {
    console.error("Error generando API Secret:", error)
    res.status(500).json({ error: "Error generando API Secret" })
  }
})

app.delete("/deleteApiSecret", validateToken, async (req, res) => {
  console.log("Eliminando API Secret del usuario")
  const uid = req.user?.sub || req.user?.user_id || req.user?.uid
  if (!uid) {
    return res.status(400).json({
      error: "No se pudo obtener el identificador del usuario del token",
    })
  }
  try {
    await prisma.usuario.update({
      where: { id: uid },
      data: { APISecret: null, isDeveloper: false },
    })
    console.log(`API Secret eliminado para el usuario ${uid}`)
    res.json({ message: "API Secret eliminado correctamente" })
  } catch (error) {
    console.error("Error eliminando API Secret:", error)
    res.status(500).json({ error: "Error eliminando API Secret" })
  }
})

app.get("/hasAPISecret", validateToken, async (req, res) => {
  console.log("Verificando si el usuario tiene API Secret")
  const uid = req.user?.sub || req.user?.user_id || req.user?.uid

  if (!uid) {
    return res.status(400).json({
      error: "No se pudo obtener el identificador del usuario del token",
    })
  }
  try {
    const user = await prisma.usuario.findUnique({
      where: { id: uid },
    })
    const hasSecret = !!(user && user.APISecret)
    console.log(`Usuario ${uid} tiene API Secret: ${hasSecret}`)
    res.json({ hasSecret })
  } catch (error) {
    console.error("Error verificando API Secret:", error)
    res.status(500).json({ error: "Error verificando API Secret" })
  }
})

app.get("/racha/:userId", validateToken, async (req, res) => {
  const { userId } = req.params
  try {
    const racha = await prisma.racha.findUnique({
      where: { usuarioId: userId },
    })
    if (!racha) {
      console.log("Racha no encontrada para el usuario:", userId)
      return res.status(404).json({ error: "Racha no encontrada" })
    }
    res.status(200).json(racha)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

//ruta inicial /
app.get("/", (req, res) => {
  res.status(200).send("Spendee API is running")
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`)
})

//module.exports = serverless(app)
module.exports = app

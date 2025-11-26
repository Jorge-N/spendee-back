const express = require("express")
const router = express.Router()
const { PrismaClient } = require("@prisma/client")
const truncateToDate = require("../../helpers/truncateToDate.js")
const validateToken = require("../../middleware/validateToken.js")

const prisma = new PrismaClient()

router.get("/", validateToken, async (req, res) => {
    console.log("Obteniendo presupuestos para el usuario:", req.user.user_id)
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

router.post("/", validateToken, async (req, res) => {
  const { monto, fechaInicio, fechaFin, PresupuestoCategoria } = req.body
  const usuarioId = req.user.user_id

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

router.delete("/:id", validateToken, async (req, res) => {
  const { id } = req.params
  try {
    const deletedPresupuestoCategorias =
      await prisma.presupuestoCategoria.deleteMany({
        where: { presupuestoId: parseInt(id) },
      })
    const deletedBudget = await prisma.presupuesto.delete({
      where: { id: parseInt(id), usuarioId: req.user.user_id },
    })
    res
      .status(200)
      .json({ message: "Presupuesto eliminado correctamente", deletedBudget })
  } catch (error) {
    console.error("Error eliminando presupuesto:", error)
    res.status(400).json({ error: error.message })
  }
})

router.put("/:id", validateToken, async (req, res) => {
  const { id } = req.params
  const { monto, fechaInicio, fechaFin, PresupuestoCategoria } = req.body

  try {
    const updatedBudget = await prisma.presupuesto.update({
      where: { id: parseInt(id), usuarioId: req.user.user_id },
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

router.get("/:budgetId", validateToken, async (req, res) => {
  const { budgetId } = req.params
  try {
    const budget = await prisma.presupuesto.findUnique({
      where: { id: parseInt(budgetId), usuarioId: req.user.user_id },
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

module.exports = router
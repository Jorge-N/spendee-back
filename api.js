const express = require('express')
const router = express.Router()
const { PrismaClient } = require('@prisma/client')
const truncateToDate = require('./helpers/truncateToDate')
const validateApiKey = require('./middleware/validateApiKey')

const prisma = new PrismaClient()

// All routes require API key auth
//router.use(validateApiKey)

// Create gasto
router.post('/gasto', async (req, res) => {
  const { gasto, categoryName} = req.body
  const userId = 'Hd6DgTtfSzfYslqr6ue1ijyRwzJ3' //cambiar

  if (gasto == null || isNaN(Number(gasto))) {
    return res.status(400).json({ error: 'Missing or invalid gasto amount' })
  }

  try {
    //busqueda o creacion de categoria
    let categoria = await prisma.categorias.findFirst({
      where: {
        nombre: categoryName,
        usuarioId: userId,
      },
    })

    let categoriaId;
    if (!categoria) {
      categoria = await prisma.categorias.create({
        data: {
          nombre: categoryName,
          usuarioId: userId,
        },
      })
    }
    categoriaId = categoria.id;

    const gastoSum = await prisma.gasto.aggregate({ where: { usuarioId: userId }, _sum: { gasto: true } })
    const ingresoSum = await prisma.ingreso.aggregate({ where: { usuarioId: userId }, _sum: { ingreso: true } })

    const sumaGastos = gastoSum._sum.gasto ? parseFloat(gastoSum._sum.gasto.toString()) : 0
    const sumaIngresos = ingresoSum._sum.ingreso ? parseFloat(ingresoSum._sum.ingreso.toString()) : 0

    const montoAnterior = sumaIngresos - sumaGastos

    const nuevoGasto = await prisma.gasto.create({
      data: {
        usuarioId: userId,
        gasto: Number(gasto),
        montoAnterior,
        fecha: new Date(),
        categoriaId: categoriaId != null ? parseInt(categoriaId) : 7, //7 = otros
      },
    })

    res.status(201).json(nuevoGasto)
  } catch (error) {
    console.error('API POST /gasto error:', error)
    res.status(400).json({ error: error.message })
  }
})

router.get('/gastos', async (req, res) => {
  try {
    const { month, year, categoryName, limit = 100, order = 'asc' } = req.query
    const userId = 'Hd6DgTtfSzfYslqr6ue1ijyRwzJ3' 

    //busqueda categoria
    let categoria = await prisma.categorias.findFirst({
      where: {
        nombre: categoryName,
        usuarioId: userId,
      },
    })

    let categoryId;
    if (!categoria) {
      //devolver error si no existe la categoria
      return res.status(400).json({ error: 'Categoria no encontrada' })
    }
    categoryId = categoria.id;


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
      orderBy: { fecha: order === 'desc' ? 'desc' : 'asc' },
      ...(limit && { take: parseInt(limit) }),
    }

    const gastos = await prisma.gasto.findMany(filters)
    res.json(gastos)
  } catch (error) {
    console.error('API /gasto error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Ingresos
router.post('/ingreso', async (req, res) => {
  const { ingreso } = req.body
  const userId = 'Hd6DgTtfSzfYslqr6ue1ijyRwzJ3' //cambiar
  try {
    const gastoSum = await prisma.gasto.aggregate({ where: { usuarioId: userId }, _sum: { gasto: true } })
    const ingresoSum = await prisma.ingreso.aggregate({ where: { usuarioId: userId }, _sum: { ingreso: true } })

    const sumaGastos = gastoSum._sum.gasto ? parseFloat(gastoSum._sum.gasto.toString()) : 0
    const sumaIngresos = ingresoSum._sum.ingreso ? parseFloat(ingresoSum._sum.ingreso.toString()) : 0

    const montoAnterior = sumaIngresos - sumaGastos

    const nuevoIngreso = await prisma.ingreso.create({
      data: { usuarioId: userId, ingreso, montoAnterior, fecha: new Date() },
    })
    res.status(201).json(nuevoIngreso)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

router.get('/ingresos', async (req, res) => {
  try {
    const { month, year, limit = 100, order = 'asc' } = req.query
    const userId = 'Hd6DgTtfSzfYslqr6ue1ijyRwzJ3' //cambiar
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
      orderBy: { fecha: order === 'desc' ? 'desc' : 'asc' },
      ...(limit && { take: parseInt(limit) }),
    }
    const ingresos = await prisma.ingreso.findMany(filters)
    res.json(ingresos)
  } catch (error) {
    console.error('API /ingreso error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get balance aggregated by month (simple version)
router.get('/balance', async (req, res) => {
  try {
    const { startDate, endDate, order = 'asc' } = req.query
    const userId = 'Hd6DgTtfSzfYslqr6ue1ijyRwzJ3' //cambiar

    const start = startDate ? new Date(startDate) : new Date('1970-01-01')
    const end = endDate ? new Date(endDate) : new Date()

    const expenses = await prisma.gasto.findMany({
      where: { usuarioId: userId, fecha: { gte: start, lte: end } },
      select: { gasto: true, fecha: true },
    })

    const incomes = await prisma.ingreso.findMany({
      where: { usuarioId: userId, fecha: { gte: start, lte: end } },
      select: { ingreso: true, fecha: true },
    })

    const formattedExpenses = expenses.map((e) => ({ monto: Number(e.gasto), fecha: e.fecha, tipo: 'expense', period: e.fecha.toISOString().slice(0, 7) }))
    const formattedIncomes = incomes.map((i) => ({ monto: Number(i.ingreso), fecha: i.fecha, tipo: 'income', period: i.fecha.toISOString().slice(0, 7) }))

    const all = [...formattedExpenses, ...formattedIncomes].sort((a, b) => new Date(a.fecha) - new Date(b.fecha))

    const grouped = Object.values(
      all.reduce((acc, mov) => {
        const { period, tipo, monto } = mov
        if (!acc[period]) acc[period] = { period, items: [], totalEgresos: 0, totalIngresos: 0 }
        acc[period].items.push(mov)
        if (tipo === 'income') acc[period].totalIngresos += monto
        if (tipo === 'expense') acc[period].totalEgresos += monto
        return acc
      }, {}),
    )

    const result = grouped.sort((a, b) => (order === 'desc' ? b.period.localeCompare(a.period) : a.period.localeCompare(b.period)))
    res.json(result)
  } catch (error) {
    console.error('API /balance error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})


// Categories
router.get('/categories', async (req, res) => {
  try {
    const uid = 'Hd6DgTtfSzfYslqr6ue1ijyRwzJ3' //cambiar
    const categorias = await prisma.categorias.findMany({ where: { OR: [{ usuarioId: '0' }, { usuarioId: uid }] } })
    res.json(categorias)
  } catch (error) {
    console.error('API /categories error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

module.exports = router

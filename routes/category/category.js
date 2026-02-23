const express = require("express")
const router = express.Router()
const { PrismaClient } = require("@prisma/client")
//const truncateToDate = require("../helpers/truncateToDate.js")
const validateToken = require("../../middleware/validateToken.js")

const prisma = new PrismaClient()

router.post("/customCategory", validateToken, async (req, res) => {
  console.log("Creando categoría personalizada")
  const { nombre, icono, color, descripcion } = req.body
  try {
    const uid = req.user.user_id
    if (!uid) {
      return res.status(401).json({ error: "Unauthorized: No user ID found" })
    }
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

router.get("/", validateToken, async (req, res) => {
  const { month, year } = req.query
  try {
    const uid = req.user.user_id
    if (!uid) {
      return res.status(401).json({ error: "Unauthorized: No user ID found" })
    }

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

router.delete("/delete/:id", validateToken, async (req, res) => {
  const { id } = req.params
  console.log("Eliminando categoría con ID:", id)
  try {
    const uid = req.user.user_id
    if (!uid) {
      return res.status(401).json({ error: "Unauthorized: No user ID found" })
    }

    const category = await prisma.categorias.findUnique({
      where: { id: Number(id), usuarioId: uid },
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

router.put("/modify/:id", validateToken, async (req, res) => {
  const { id } = req.params
  const { categoria, descripcion, icono, color } = req.body

  try {
    const uid = req.user.user_id
    if (!uid) {
      return res.status(401).json({ error: "Unauthorized: No user ID found" })
    }
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

module.exports = router

const express = require("express")
const router = express.Router()
const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()

router.get("/", (req, res) => {
  res.json({ message: "Levels endpoint is working" })
})

router.get("/:id", async (req, res) => {
  const { id } = req.params
  try {
    const level = await prisma.nivelUsuario.findUnique({
      where: { usuarioId: id },
    })

    if (!level) {
      return res.json({ level: 1 })
    }

    res.json(level)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error fetching level" })
  }
})

//quiero los objetivos de un nivel
router.get("/objetivos/:nivel", async (req, res) => {
  const { nivel } = req.params
  try {
    const nivelData = await prisma.niveles.findMany({
      where: { id: parseInt(nivel) },
      include: { objetivos: true },
    })
    res.json(nivelData ? nivelData[0].objetivos : [])
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error fetching objetivos" })
  }
})

module.exports = router

const serverless = require("serverless-http")
const express = require("express")
const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()
const app = express()

app.use(express.json())

app.get("/", (req, res) => {
  res.status(200).send("Spendee API is running")
})

app.get("/gasto", async (req, res) => {
  const gastos = await prisma.gasto.findMany()
  res.json(gastos)
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`)
})

module.exports = serverless(app)

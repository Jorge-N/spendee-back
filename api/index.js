const serverless = require("serverless-http")
const express = require("express")
const { PrismaClient } = require("@prisma/client")
const { PrismaNeon } = require("@prisma/adapter-neon")

const app = express()
let prisma
if (!global.__prisma) {
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL })
  global.__prisma = new PrismaClient({ adapter })
}
prisma = global.__prisma

app.use(express.json())

app.get("/health", (req, res) => {
  res.status(200).send("OK")
})

module.exports = serverless(app)

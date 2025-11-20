const express = require("express")
const router = express.Router()
const { PrismaClient } = require("@prisma/client")
const { Model } = require("firebase-admin/machine-learning")

const prisma = new PrismaClient()

router.get("/", (req, res) => {
  res.json({ message: "Levels endpoint is working" })
})

module.exports = router

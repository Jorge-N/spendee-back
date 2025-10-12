const serverless = require("serverless-http")
const express = require("express")
const app = express()

app.use(express.json())

app.get("/health", (req, res) => {
  res.status(200).send("OK")
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`)
})

module.exports = serverless(app)

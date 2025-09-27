const express = require("express");
const { PrismaClient } = require("@prisma/client");
const jwt = require("jsonwebtoken");
const app = express();
const prisma = new PrismaClient();

app.use(express.json());

// Middleware para validar JWT
function validarJWT(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Token no proporcionado" });
  }
  // Solo decodifica, no verifica firma (para Google JWT)
  try {
    const decoded = jwt.decode(token);
    req.usuario = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: "Token inválido" });
  }
}

app.get("/", (req, res) => {
  res.send("API de Gestion de Gastos");
});

// Ruta protegida para crear un gasto
app.post("/gasto", async (req, res) => {
  const { userId, gasto, montoAnterior } = req.body;
  try {
    const nuevoGasto = await prisma.gasto.create({
      data: {
        usuarioId: userId,
        gasto,
        montoAnterior,
        fecha: new Date(),
      },
    });
    res.status(201).json(nuevoGasto);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Ruta para obtener todos los gastos
app.get("/gasto", async (req, res) => {
  const gastos = await prisma.gasto.findMany();
  res.json(gastos);
});

app.post("/ingreso", async (req, res) => {
  const { userId, ingreso, montoAnterior } = req.body;
  console.log(userId);
  try {
    const nuevoIngreso = await prisma.ingreso.create({
      data: {
        usuarioId: userId,
        ingreso,
        montoAnterior,
        fecha: new Date(),
      },
    });
    res.status(201).json(nuevoIngreso);
    console.log(userId);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Ruta para obtener todos los ingresos
app.get("/ingreso", async (req, res) => {
  const ingresos = await prisma.ingreso.findMany();
  res.json(ingresos);
});

app.get("/balance/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const gastos = await prisma.gasto.findMany({
      where: { usuarioId: userId },
    });
    const sumaGastos = gastos.reduce((total, gasto) => total + gasto.gasto, 0);
    const ingresos = await prisma.ingreso.findMany({
      where: { usuarioId: userId },
    });
    const sumaIngresos = ingresos.reduce(
      (total, ingreso) => total + ingreso.ingreso,
      0
    );
    const balance = sumaIngresos - sumaGastos;
    res.json({ balance, sumaIngresos, sumaGastos });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(typeof 99.99);
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});

module.exports = app;

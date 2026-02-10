const request = require("supertest")
const express = require("express")
const router = require("../routes/fixed-expenses/fixed-expense")

const { PrismaClient } = require("@prisma/client")
jest.mock("@prisma/client", () => {
  const mPrisma = {
    gastoFijo: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  }
  return { PrismaClient: jest.fn(() => mPrisma) }
})

const prisma = new PrismaClient()

jest.mock("../middleware/validateToken.js", () => (req, res, next) => {
  req.user = { user_id: "user-123" }
  next()
})

const app = express()
app.use(express.json())
app.use("/fixed-expense", router)

describe("Fixed Expense Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("POST /create", () => {
    it("debería crear un gasto fijo exitosamente", async () => {
      const mockGasto = { id: 1, nombre: "Netflix", gasto: 5000 }
      prisma.gastoFijo.create.mockResolvedValue(mockGasto)

      const res = await request(app).post("/fixed-expense/create").send({
        nombre: "Netflix",
        gasto: 5000,
        diaDeVencimiento: 10,
        metodoPago: "tarjeta",
        categoriaId: 1,
      })

      expect(res.statusCode).toBe(201)
      expect(res.body).toEqual(mockGasto)
      expect(prisma.gastoFijo.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          nombre: "Netflix",
          usuarioId: "user-123",
        }),
      })
    })

    it("debería devolver error 400 si falla la creación", async () => {
      prisma.gastoFijo.create.mockRejectedValue(new Error("Prisma Error"))

      const res = await request(app).post("/fixed-expense/create").send({})
      expect(res.statusCode).toBe(400)
      expect(res.body.error).toBe("Prisma Error")
    })
  })

  describe("GET /", () => {
    it("debería obtener todos los gastos fijos", async () => {
      const mockList = [
        { id: 1, nombre: "Netflix" },
        { id: 2, nombre: "Facultad" },
      ]
      prisma.gastoFijo.findMany.mockResolvedValue(mockList)

      const res = await request(app).get("/fixed-expense")
      expect(res.statusCode).toBe(200)
      expect(res.body.length).toBe(2)
    })
  })

  describe("GET /:id", () => {
    it("debería devolver 404 si el gasto no existe", async () => {
      prisma.gastoFijo.findUnique.mockResolvedValue(null)

      const res = await request(app).get("/fixed-expense/999")
      expect(res.statusCode).toBe(404)
      expect(res.body.error).toBe("Gasto no encontrado")
    })

    it("debería devolver el gasto si existe", async () => {
      const mockGasto = { id: 1, nombre: "Internet" }
      prisma.gastoFijo.findUnique.mockResolvedValue(mockGasto)

      const res = await request(app).get("/fixed-expense/1")
      expect(res.statusCode).toBe(200)
      expect(res.body.nombre).toBe("Internet")
    })
  })

  describe("PATCH /:id", () => {
    it("debería actualizar el gasto correctamente", async () => {
      prisma.gastoFijo.update.mockResolvedValue({ id: 1 })

      const res = await request(app)
        .patch("/fixed-expense/1")
        .send({ nombre: "Gasto Editado" })

      expect(res.statusCode).toBe(200)
      expect(res.body.message).toBe("Gasto fijo actualizado con éxito")
    })
  })

  describe("DELETE /:id", () => {
    it("debería eliminar el gasto", async () => {
      prisma.gastoFijo.delete.mockResolvedValue({ id: 1 })

      const res = await request(app).delete("/fixed-expense/1")
      expect(res.statusCode).toBe(200)
      expect(res.body.message).toBe("Gasto fijo eliminado")
    })
  })
})

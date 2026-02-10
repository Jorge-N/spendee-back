const request = require("supertest")
const express = require("express")
const router = require("../routes/fixed-incomes/fixed-income")

const { PrismaClient } = require("@prisma/client")

jest.mock("@prisma/client", () => {
  const mPrisma = {
    ingresoFijo: {
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
const MOCK_USER_ID = "user-mock"

jest.mock("../middleware/validateToken.js", () => (req, res, next) => {
  req.user = { user_id: MOCK_USER_ID }
  next()
})

const app = express()
app.use(express.json())
app.use("/fixed-income", router)

describe("Fixed Income Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("POST /create", () => {
    it("debería crear un ingreso fijo exitosamente", async () => {
      const mockIngreso = {
        id: 1,
        ingreso: 150000,
        frecuencia: "MONTHLY",
        usuarioId: MOCK_USER_ID,
      }
      prisma.ingresoFijo.create.mockResolvedValue(mockIngreso)

      const res = await request(app).post("/fixed-income/create").send({
        ingreso: "150000",
        frecuencia: "MONTHLY",
      })

      expect(res.statusCode).toBe(201)
      expect(res.body).toEqual(mockIngreso)
      expect(prisma.ingresoFijo.create).toHaveBeenCalledWith({
        data: {
          usuarioId: MOCK_USER_ID,
          ingreso: 150000,
          frecuencia: "MONTHLY",
        },
      })
    })

    it("debería devolver error 400 si falla Prisma", async () => {
      prisma.ingresoFijo.create.mockRejectedValue(new Error("Database error"))
      const res = await request(app)
        .post("/fixed-income/create")
        .send({ ingreso: 100 })
      expect(res.statusCode).toBe(400)
      expect(res.body.error).toBe("Database error")
    })
  })

  describe("GET /", () => {
    it("debería obtener la lista de ingresos", async () => {
      const mockList = [
        { id: 1, ingreso: 5000 },
        { id: 2, ingreso: 7000 },
      ]
      prisma.ingresoFijo.findMany.mockResolvedValue(mockList)

      const res = await request(app).get("/fixed-income")
      expect(res.statusCode).toBe(200)
      expect(res.body.length).toBe(2)
    })
  })

  describe("GET /:id", () => {
    it("debería devolver 404 si el ingreso no existe", async () => {
      prisma.ingresoFijo.findUnique.mockResolvedValue(null)

      const res = await request(app).get("/fixed-income/55")
      expect(res.statusCode).toBe(404)
      expect(res.body.error).toBe("Gasto no encontrado")
    })

    it("debería devolver el ingreso si el ID es correcto", async () => {
      const mock = { id: 55, ingreso: 2000, usuarioId: MOCK_USER_ID }
      prisma.ingresoFijo.findUnique.mockResolvedValue(mock)

      const res = await request(app).get("/fixed-income/55")
      expect(res.statusCode).toBe(200)
      expect(res.body.id).toBe(55)
    })
  })

  describe("PATCH /:id", () => {
    it("debería actualizar el ingreso correctamente", async () => {
      prisma.ingresoFijo.update.mockResolvedValue({ id: 10 })

      const res = await request(app)
        .patch("/fixed-income/10")
        .send({ ingreso: "300000", frecuencia: "YEARLY" })

      expect(res.statusCode).toBe(200)
      expect(res.body.message).toBe("Ingreso fijo actualizado con éxito")
      expect(prisma.ingresoFijo.update).toHaveBeenCalledWith({
        where: { id: 10, usuarioId: MOCK_USER_ID },
        data: { ingreso: 300000, frecuencia: "YEARLY" },
      })
    })
  })

  describe("DELETE /:id", () => {
    it("debería eliminar el registro", async () => {
      const mockDeleted = { id: 10, ingreso: 100 }
      prisma.ingresoFijo.delete.mockResolvedValue(mockDeleted)

      const res = await request(app).delete("/fixed-income/10")
      expect(res.statusCode).toBe(200)
      expect(res.body.message).toBe("Ingreso fijo eliminado")
      expect(res.body.ingresoFijoEliminado).toEqual(mockDeleted)
    })
  })
})

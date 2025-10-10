const request = require("supertest")

jest.mock("@prisma/client", () => {
  const mPrisma = {
    gasto: {
      findMany: jest.fn(),
      create: jest.fn(),
      aggregate: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
      groupBy: jest.fn(),
    },
    ingreso: {
      findMany: jest.fn(),
      create: jest.fn(),
      aggregate: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    categorias: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  }
  return { PrismaClient: jest.fn(() => mPrisma) }
})
jest.mock("../middleware/validateToken.js", () => {
  return (req, res, next) => {
    req.usuario = { usuarioId: "123", name: "Test User" }
    next()
  }
})

const app = require("../index")
const { PrismaClient } = require("@prisma/client")

describe("GET /", () => {
  it("Cuando se ingresa a la ruta basica, debe aparecer un mensaje de bienvenida", async () => {
    const res = await request(app).get("/")
    expect(res.statusCode).toBe(200)
    expect(res.text).toBe("API de Gestión de Gastos")
  })
})

describe("GET /gasto", () => {
  let prisma
  beforeEach(() => {
    prisma = new PrismaClient()
  })
  afterEach(() => {
    jest.clearAllMocks()
  })
  it("Cuando no hay gastos, la respuesta debe ser una lista vacía", async () => {
    prisma.gasto.findMany.mockResolvedValue([])
    const res = await request(app).get("/gasto")
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual([])
  })
  it("Cuando hay gastos, la respuesta debe ser una lista con los gastos", async () => {
    const gastosMock = [
      {
        id: 1,
        usuarioId: 1,
        gasto: 50,
        montoAnterior: 100,
        fecha: String(new Date()),
      },
      {
        id: 2,
        usuarioId: 1,
        gasto: 30,
        montoAnterior: 50,
        fecha: String(new Date()),
      },
    ]
    prisma.gasto.findMany.mockResolvedValue(gastosMock)
    const res = await request(app).get("/gasto")
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual(gastosMock)
  })
})

describe("GET /ingreso", () => {
  let prisma
  beforeEach(() => {
    prisma = new PrismaClient()
  })
  afterEach(() => {
    jest.clearAllMocks()
  })
  it("Cuando no hay ingresos, la respuesta debe ser una lista vacía", async () => {
    prisma.ingreso.findMany.mockResolvedValue([])
    const res = await request(app).get("/ingreso")
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual([])
  })
  it("Cuando hay ingresos, la respuesta debe ser una lista con los ingresos", async () => {
    const ingresosMock = [
      {
        id: 1,
        usuarioId: 1,
        ingreso: 100,
        montoAnterior: 0,
        fecha: String(new Date()),
      },
      {
        id: 2,
        usuarioId: 1,
        ingreso: 50,
        montoAnterior: 100,
        fecha: String(new Date()),
      },
    ]
    prisma.ingreso.findMany.mockResolvedValue(ingresosMock)
    const res = await request(app).get("/ingreso")
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual(ingresosMock)
  })
})

describe("GET /balance/userId", () => {
  let prisma
  beforeEach(() => {
    prisma = new PrismaClient()
  })
  afterEach(() => {
    jest.clearAllMocks()
  })
  it("Cuando no hay ingresos ni gastos, el balance debe ser 0", async () => {
    prisma.gasto.aggregate.mockResolvedValue({ _sum: { gasto: 0 } })
    prisma.ingreso.aggregate.mockResolvedValue({ _sum: { ingreso: 0 } })
    const res = await request(app).get("/balance/0")
    expect(res.statusCode).toBe(200)
    expect(res.body.balance).toEqual(0)
  })
  it("Cuando gasto 100 e ingreso 200, el balance debe ser 100", async () => {
    prisma.gasto.aggregate.mockResolvedValue({ _sum: { gasto: 100 } })
    prisma.ingreso.aggregate.mockResolvedValue({
      _sum: { ingreso: 200 },
    })
    const res = await request(app).get("/balance/0")
    expect(res.statusCode).toBe(200)
    expect(res.body.balance).toEqual(100)
  })
  it("Cuando hay solo gastos por 100, el balance debe ser -100", async () => {
    prisma.gasto.aggregate.mockResolvedValue({ _sum: { gasto: 100 } })
    prisma.ingreso.aggregate.mockResolvedValue({ _sum: { ingreso: 0 } })
    const res = await request(app).get("/balance/0")
    expect(res.statusCode).toBe(200)
    expect(res.body.balance).toEqual(-100)
  })
  it("Cuando hay solo ingresos por 100, el balance debe ser 100", async () => {
    prisma.gasto.aggregate.mockResolvedValue({ _sum: { gasto: 0 } })
    prisma.ingreso.aggregate.mockResolvedValue({
      _sum: { ingreso: 100 },
    })
    const res = await request(app).get("/balance/0")
    expect(res.statusCode).toBe(200)
    expect(res.body.balance).toEqual(100)
  })
  it("Cuando userId no existe en la tabla gasto o ingreso, el balance debe ser 0", async () => {
    prisma.gasto.findMany.mockResolvedValue([])
    prisma.ingreso.findMany.mockResolvedValue([])
    const res = await request(app).get("/balance/0")
    expect(res.statusCode).toBe(200)
    expect(res.body.balance).toEqual(100)
  })
  it("Cuando userId no existe en la tabla gasto o ingreso, el balance debe ser 0", async () => {
    prisma.gasto.aggregate.mockResolvedValue({ _sum: { gasto: 0 } })
    prisma.ingreso.aggregate.mockResolvedValue({ _sum: { ingreso: 0 } })
    const res = await request(app).get("/balance/0")
    expect(res.statusCode).toBe(200)
    expect(res.body.balance).toEqual(0)
  })
})

describe("POST /ingreso", () => {
  let prisma
  beforeEach(() => {
    prisma = new PrismaClient()
  })
  afterEach(() => {
    jest.clearAllMocks()
  })
  it("Cuando se crea un ingreso, debe devolver el ingreso creado", async () => {
    const nuevoIngreso = {
      id: 1,
      usuarioId: 1,
      ingreso: 150,
      montoAnterior: 100,
      fecha: String(new Date()),
    }
    prisma.ingreso.create.mockResolvedValue(nuevoIngreso)
    const res = await request(app).post("/ingreso").send({
      userId: 1,
      ingreso: 150,
      montoAnterior: 100,
    })
    expect(res.statusCode).toBe(201)
    expect(res.body).toEqual(nuevoIngreso)
  })
  it("cuando hay un error en prisma, me devuelve un codigo de error 400", async () => {
    prisma.ingreso.create.mockRejectedValue(new Error("DB error"))
    const res = await request(app).post("/ingreso").send({
      userId: 1,
      ingreso: 150,
      montoAnterior: 100,
    })
    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: "DB error" })
  })
  it("cuando falta un campo obligatorio, me devuelve un codigo de error 400", async () => {
    const res = await request(app).post("/ingreso").send({
      montoAnterior: 100,
    })
    expect(res.statusCode).toBe(400)
    expect(res.body).toHaveProperty("error")
  })
  it("cuando el ingreso es un string, me devuelve un codigo de error 400", async () => {
    const res = await request(app).post("/ingreso").send({
      userId: 1,
      ingreso: "cien",
      montoAnterior: 100,
    })
    expect(res.statusCode).toBe(400)
    expect(res.body).toHaveProperty("error")
  })
  it("cuando el ingreso es null, me devuelve un codigo de error 400", async () => {
    const res = await request(app).post("/ingreso").send({
      userId: 1,
      ingreso: null,
      montoAnterior: 100,
    })
    expect(res.statusCode).toBe(400)
    expect(res.body).toHaveProperty("error")
  })
})

describe("POST /gasto", () => {
  let prisma
  beforeEach(() => {
    prisma = new PrismaClient()
  })
  afterEach(() => {
    jest.clearAllMocks()
  })
  it("Cuando se crea un gasto, debe devolver el gasto creado", async () => {
    const nuevoGasto = {
      id: 1,
      usuarioId: 1,
      gasto: 80,
      montoAnterior: 200,
      fecha: String(new Date()),
    }
    prisma.gasto.create.mockResolvedValue(nuevoGasto)
    const res = await request(app).post("/gasto").send({
      userId: 1,
      gasto: 80,
      montoAnterior: 200,
    })
    expect(res.statusCode).toBe(201)
    expect(res.body).toEqual(nuevoGasto)
  })
  it("cuando hay un error en prisma, me devuelve un codigo de error 400", async () => {
    prisma.gasto.create.mockRejectedValue(new Error("DB error"))

    const res = await request(app).post("/gasto").send({
      userId: 1,
      gasto: 100,
      montoAnterior: 0,
    })

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: "DB error" })
  })

  it("cuando falta un campo obligatorio, me devuelve un codigo de error 400", async () => {
    const res = await request(app).post("/gasto").send({
      montoAnterior: 100,
    })

    expect(res.statusCode).toBe(400)
    expect(res.body).toHaveProperty("error")
  })
  it("cuando el gasto es un string, me devuelve un codigo de error 400", async () => {
    const res = await request(app).post("/gasto").send({
      userId: 1,
      gasto: "cien",
      montoAnterior: 100,
    })
    expect(res.statusCode).toBe(400)
    expect(res.body).toHaveProperty("error")
  })
  it("cuando el gasto es null, me devuelve un codigo de error 400", async () => {
    const res = await request(app).post("/gasto").send({
      userId: 1,
      gasto: null,
      montoAnterior: 100,
    })
    expect(res.statusCode).toBe(400)
    expect(res.body).toHaveProperty("error")
  })
})

describe("GET /gasto/:userId", () => {
  let prisma
  beforeEach(() => {
    prisma = new PrismaClient()
  })
  afterEach(() => {
    jest.clearAllMocks()
  })
  it("Cuando no hay gastos para el userId, la respuesta debe ser una lista vacía", async () => {
    prisma.gasto.findMany.mockResolvedValue([])
    const res = await request(app).get("/gasto/1")
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual([])
  })
  it("Cuando hay gastos para el userId, la respuesta debe ser una lista con los gastos", async () => {
    const gastosMock = [
      {
        id: 1,
        usuarioId: 1,
        gasto: 50,
        montoAnterior: 100,
        fecha: String(new Date()),
      },
      {
        id: 2,
        usuarioId: 1,
        gasto: 30,
        montoAnterior: 50,
        fecha: String(new Date()),
      },
    ]
    prisma.gasto.findMany.mockResolvedValue(gastosMock)
    const res = await request(app).get("/gasto/1")
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual(gastosMock)
  })
})

describe("GET /ingreso/:userId", () => {
  let prisma
  beforeEach(() => {
    prisma = new PrismaClient()
  })
  afterEach(() => {
    jest.clearAllMocks()
  })
  it("Cuando no hay ingresos para el userId, la respuesta debe ser una lista vacía", async () => {
    prisma.ingreso.findMany.mockResolvedValue([])
    const res = await request(app).get("/ingreso/1")
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual([])
  })
  it("Cuando hay ingresos para el userId, la respuesta debe ser una lista con los ingresos", async () => {
    const ingresosMock = [
      {
        id: 1,
        usuarioId: 1,
        ingreso: 100,
        montoAnterior: 0,
        fecha: String(new Date()),
      },
      {
        id: 2,
        usuarioId: 1,
        ingreso: 200,
        montoAnterior: 100,
        fecha: String(new Date()),
      },
    ]
    prisma.ingreso.findMany.mockResolvedValue(ingresosMock)
    const res = await request(app).get("/ingreso/1")
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual(ingresosMock)
  })
})

describe("GET /ingresoPorId/:id", () => {
  let prisma
  beforeEach(() => {
    prisma = new PrismaClient()
  })
  afterEach(() => {
    jest.clearAllMocks()
  })
  it("Cuando el ingreso con el id especificado no existe, la respuesta debe ser un error 404", async () => {
    prisma.ingreso.findUnique.mockResolvedValue(null)
    const res = await request(app).get("/ingresoPorId/999")
    expect(res.statusCode).toBe(404)
    expect(res.body).toEqual({ error: "Ingreso no encontrado" })
  })
  it("Cuando el ingreso con el id especificado existe, la respuesta debe ser el ingreso", async () => {
    const ingresoMock = {
      id: 1,
      usuarioId: 1,
      ingreso: 100,
      montoAnterior: 0,
      fecha: String(new Date()),
    }
    prisma.ingreso.findUnique.mockResolvedValue(ingresoMock)
    const res = await request(app).get("/ingresoPorId/1")
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual(ingresoMock)
  })
  it("Cuando el id no es un número, la respuesta debe ser un error 400", async () => {
    const res = await request(app).get("/ingresoPorId/abc")
    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: "ID inválido" })
  })
})

describe("GET /gastoPorId/:id", () => {
  let prisma
  beforeEach(() => {
    prisma = new PrismaClient()
  })
  afterEach(() => {
    jest.clearAllMocks()
  })
  it("Cuando el gasto con el id especificado no existe, la respuesta debe ser un error 404", async () => {
    prisma.gasto.findUnique.mockResolvedValue(null)
    const res = await request(app).get("/gastoPorId/999")
    expect(res.statusCode).toBe(404)
    expect(res.body).toEqual({ error: "Gasto no encontrado" })
  })
  it("Cuando el gasto con el id especificado existe, la respuesta debe ser el gasto", async () => {
    const gastoMock = {
      id: 1,
      usuarioId: 1,
      ingreso: 100,
      montoAnterior: 0,
      fecha: String(new Date()),
    }
    prisma.gasto.findUnique.mockResolvedValue(gastoMock)
    const res = await request(app).get("/gastoPorId/1")
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual(gastoMock)
  })
  it("Cuando el id no es un número, la respuesta debe ser un error 400", async () => {
    const res = await request(app).get("/gastoPorId/abc")
    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: "ID inválido" })
  })
})

describe("DELETE /gasto/:id", () => {
  let prisma
  beforeEach(() => {
    prisma = new PrismaClient()
  })
  afterEach(() => {
    jest.clearAllMocks()
  })
  it("Cuando el gasto con el id especificado existe, la respuesta debe ser un mensaje de éxito", async () => {
    const gastoMock = {
      id: 1,
      usuarioId: 1,
      gasto: 100,
      montoAnterior: 0,
      fecha: String(new Date()),
    }
    prisma.gasto.findUnique.mockResolvedValue(gastoMock)
    const res = await request(app).delete("/gasto/1")
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ message: "Gasto eliminado correctamente" })
  })
  it("Cuando el id no es un número, la respuesta debe ser un error 400", async () => {
    const res = await request(app).delete("/gasto/abc")
    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: "ID inválido" })
  })
})

describe("POST /customCategory", () => {
  let prisma
  beforeEach(() => {
    prisma = new PrismaClient()
  })
  afterEach(() => {
    jest.clearAllMocks()
  })
  it("Cuando se crea una categoria, debe devolver la categoria creada", async () => {
    const nuevaCategoria = {
      id: 1,
      nombre: "Comida",
      usuarioId: 123,
      icono: "Wine",
      color: "#FFFFFF",
      descripcion: "Una descripción de comida",
    }
    prisma.categorias.create.mockResolvedValue(nuevaCategoria)
    const res = await request(app).post("/customCategory").send({
      nombre: "Comida",
      icono: "Wine",
      color: "#FFFFFF",
      descripcion: "Una descripción de comida",
    })
    expect(res.statusCode).toBe(201)
    expect(res.body).toEqual(nuevaCategoria)
  })
  it("cuando hay un error en prisma, me devuelve un codigo de error 400", async () => {
    prisma.categorias.create.mockRejectedValue(new Error("DB error"))
    const res = await request(app).post("/customCategory").send({
      nombre: "Comida",
      icono: "Wine",
      color: "#FFFFFF",
      descripcion: "Una descripción de comida",
    })
    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: "DB error" })
  })
  it("cuando falta un campo obligatorio, me devuelve un codigo de error 400", async () => {
    const res = await request(app).post("/customCategory").send({
      icono: "Wine",
      color: "#FFFFFF",
      descripcion: "Una descripción de comida",
    })
    expect(res.statusCode).toBe(400)
    expect(res.body).toHaveProperty("error")
  })
})

describe("GET /categories", () => {
  let prisma
  beforeEach(() => {
    prisma = new PrismaClient()
  })
  afterEach(() => {
    jest.clearAllMocks()
  })
  it("Cuando no hay categorias, la respuesta debe ser una lista vacía", async () => {
    prisma.categorias.findMany.mockResolvedValue([])
    const res = await request(app).get("/categories")
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual([])
  })
  it("Cuando la categoria existe pero no tiene gastos, la suma de gastos debe ser 0", async () => {
    const categoriasMock = [
      {
        id: 1,
        nombre: "Comida",
        usuarioId: 123,
        icono: "Wine",
        color: "#FFFFFF",
        descripcion: "Una descripción de comida",
      },
    ]
    const resCategoriasMock = [
      {
        id: 1,
        nombre: "Comida",
        icono: "Wine",
        color: "#FFFFFF",
        descripcion: "Una descripción de comida",
        totalGastos: 0,
      },
    ]
    prisma.categorias.findMany.mockResolvedValue(categoriasMock)
    const res = await request(app).get("/categories")
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual(resCategoriasMock)
  })
})

describe("POST /gastosPorCategoria", () => {
  let prisma
  beforeEach(() => {
    prisma = new PrismaClient()
  })
  afterEach(() => {
    jest.clearAllMocks()
  })
  it("Cuando no hay gastos para la categoria, la respuesta debe ser una lista vacía", async () => {
    prisma.gasto.groupBy.mockResolvedValue([])
    const res = await request(app).post("/gastosPorCategoria").send({ id: 5 })
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual([])
  })
  it("Cuando hay gastos para la categoria, la respuesta debe ser una lista con los gastos agrupados por categoria", async () => {
    const gastosPorCategoriaMock = [
      {
        id: 1,
        categoriaId: 1,
        monto: 100,
      },
      {
        id: 2,
        categoriaId: 1,
        monto: 200,
      },
    ]
    prisma.gasto.groupBy.mockResolvedValue(gastosPorCategoriaMock)
    const res = await request(app).post("/gastosPorCategoria").send({ id: 1 })
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual(gastosPorCategoriaMock)
  })
  it("Cuando falta el campo id en el body, la respuesta debe ser un error 400", async () => {
    const res = await request(app).post("/gastosPorCategoria").send({})
    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: "ID de categoría es requerido" })
  })
  it("Cuando el id no es un número, la respuesta debe ser un error 400", async () => {
    const res = await request(app)
      .post("/gastosPorCategoria")
      .send({ id: "abc" })
    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: "ID inválido" })
  })
  it("Cuando hay un error en prisma, la respuesta debe ser un error 400", async () => {
    prisma.gasto.groupBy.mockRejectedValue(new Error("DB error"))
    const res = await request(app).post("/gastosPorCategoria").send({ id: 1 })
    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: "DB error" })
  })
})

const request = require("supertest")

jest.mock("@prisma/client", () => {
  const mPrisma = {
    gasto: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({}),
      aggregate: jest.fn().mockResolvedValue({ _sum: { gasto: 0 } }),
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue({}),
      groupBy: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      update: jest.fn().mockResolvedValue({}),
    },
    ingreso: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({}),
      aggregate: jest.fn().mockResolvedValue({ _sum: { ingreso: 0 } }),
      findUnique: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
    categorias: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
    presupuesto: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
    },
    presupuestoCategoria: {
      deleteMany: jest.fn().mockResolvedValue({}),
      createMany: jest.fn().mockResolvedValue({}),
    },
    racha: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
    usuario: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({}),
    },
    $queryRaw: jest.fn().mockResolvedValue([]),
  }
  return { PrismaClient: jest.fn(() => mPrisma), mockedPrisma: mPrisma }
})
jest.mock("../middleware/validateToken.js", () => {
  return (req, res, next) => {
    req.user = { user_id: "123", name: "Test User" }
    next()
  }
})

const app = require("../index")
const { PrismaClient, mockedPrisma } = require("@prisma/client")

describe("GET /", () => {
  it("Cuando se ingresa a la ruta basica, debe aparecer un mensaje de bienvenida", async () => {
    const res = await request(app).get("/")
    expect(res.statusCode).toBe(200)
    expect(res.text).toBe("Spendee API is running")
  })
})

describe("GET /gasto", () => {
  let prisma
  beforeEach(() => {
    prisma = mockedPrisma
  })
  afterEach(() => {
    jest.clearAllMocks()
  })
  it("Cuando no hay gastos, la respuesta debe ser una lista vacía", async () => {
    prisma.gasto.findMany.mockResolvedValue([])
    const res = await request(app).get("/expense")
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
    const res = await request(app).get("/expense")
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual(gastosMock)
  })
})

describe("GET /ingreso", () => {
  let prisma
  beforeEach(() => {
    prisma = mockedPrisma
  })
  afterEach(() => {
    jest.clearAllMocks()
  })
  it("Cuando no hay ingresos, la respuesta debe ser una lista vacía", async () => {
    prisma.ingreso.findMany.mockResolvedValue([])
    const res = await request(app).get("/income")
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
    const res = await request(app).get("/income")
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual(ingresosMock)
  })
})

describe("GET /balance/userId", () => {
  let prisma
  beforeEach(() => {
    prisma = mockedPrisma
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
    prisma.gasto.aggregate.mockResolvedValue({ _sum: { gasto: 0 } })
    prisma.ingreso.aggregate.mockResolvedValue({ _sum: { ingreso: 0 } })
    const res = await request(app).get("/balance/0")
    expect(res.statusCode).toBe(200)
    expect(res.body.balance).toEqual(0)
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
    prisma = mockedPrisma
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
    const res = await request(app).post("/income").send({
      ingreso: 150,
      montoAnterior: 100,
    })
    expect(res.statusCode).toBe(201)
    expect(res.body).toEqual(nuevoIngreso)
  })
  it("cuando hay un error en prisma, me devuelve un codigo de error 400", async () => {
    prisma.ingreso.create.mockRejectedValue(new Error("DB error"))
    const res = await request(app).post("/income").send({
      ingreso: 150,
      montoAnterior: 100,
    })
    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: "DB error" })
  })
  it("cuando falta un campo obligatorio, me devuelve un codigo de error 400", async () => {
    const res = await request(app).post("/income").send({
      montoAnterior: 100,
    })
    expect(res.statusCode).toBe(400)
    expect(res.body).toHaveProperty("error")
  })
  it("cuando el ingreso es un string, me devuelve un codigo de error 400", async () => {
    const res = await request(app).post("/income").send({
      ingreso: "cien",
      montoAnterior: 100,
    })
    expect(res.statusCode).toBe(400)
    expect(res.body).toHaveProperty("error")
  })
  it("cuando el ingreso es null, me devuelve un codigo de error 400", async () => {
    const res = await request(app).post("/income").send({
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
    prisma = mockedPrisma
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
    const res = await request(app).post("/expense").send({
      gasto: 80,
      montoAnterior: 200,
    })
    expect(res.statusCode).toBe(201)
    expect(res.body).toEqual(nuevoGasto)
  })
  it("cuando hay un error en prisma, me devuelve un codigo de error 400", async () => {
    prisma.gasto.create.mockRejectedValue(new Error("DB error"))

    const res = await request(app).post("/expense").send({
      gasto: 100,
      montoAnterior: 0,
    })

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: "DB error" })
  })

  it("cuando falta un campo obligatorio, me devuelve un codigo de error 400", async () => {
    const res = await request(app).post("/expense").send({
      montoAnterior: 100,
    })

    expect(res.statusCode).toBe(400)
    expect(res.body).toHaveProperty("error")
  })
  it("cuando el gasto es un string, me devuelve un codigo de error 400", async () => {
    const res = await request(app).post("/expense").send({
      gasto: "cien",
      montoAnterior: 100,
    })
    expect(res.statusCode).toBe(400)
    expect(res.body).toHaveProperty("error")
  })
  it("cuando el gasto es null, me devuelve un codigo de error 400", async () => {
    const res = await request(app).post("/expense").send({
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
    prisma = mockedPrisma
  })
  afterEach(() => {
    jest.clearAllMocks()
  })
  it("Cuando no hay gastos para el userId, la respuesta debe ser una lista vacía", async () => {
    prisma.gasto.findMany.mockResolvedValue([])
    const res = await request(app).get("/expense")
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
    const res = await request(app).get("/expense")
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual(gastosMock)
  })
})

describe("GET /ingreso/:userId", () => {
  let prisma
  beforeEach(() => {
    prisma = mockedPrisma
  })
  afterEach(() => {
    jest.clearAllMocks()
  })
  it("Cuando no hay ingresos para el userId, la respuesta debe ser una lista vacía", async () => {
    prisma.ingreso.findMany.mockResolvedValue([])
    const res = await request(app).get("/income")
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
    const res = await request(app).get("/income")
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual(ingresosMock)
  })
})

describe("GET /ingresoPorId/:id", () => {
  let prisma
  beforeEach(() => {
    prisma = mockedPrisma
  })
  afterEach(() => {
    jest.resetAllMocks()
  })
  it("Cuando el ingreso con el id especificado no existe, la respuesta debe ser un error 404", async () => {
    prisma.ingreso.findUnique.mockResolvedValue(null)
    const res = await request(app).get("/income/byId/999")
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
    const res = await request(app).get("/income/byId/1")
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual(ingresoMock)
  })
  it("Cuando el id no es un número, la respuesta debe ser un error 400", async () => {
    const res = await request(app).get("/income/byId/abc")
    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: "ID inválido" })
  })
})

describe("GET /gastoPorId/:id", () => {
  let prisma
  beforeEach(() => {
    prisma = mockedPrisma
  })
  afterEach(() => {
    jest.clearAllMocks()
  })
  it("Cuando el gasto con el id especificado no existe, la respuesta debe ser un error 404", async () => {
    prisma.gasto.findFirst.mockResolvedValue(null)
    const res = await request(app).get("/expense/byId/999")
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
    prisma.gasto.findFirst.mockResolvedValue(gastoMock)
    const res = await request(app).get("/expense/byId/1")
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual(gastoMock)
  })
  it("Cuando el id no es un número, la respuesta debe ser un error 400", async () => {
    const res = await request(app).get("/expense/byId/abc")
    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: "ID inválido" })
  })
})

describe("DELETE /gasto/:id", () => {
  let prisma
  beforeEach(() => {
    prisma = mockedPrisma
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
    const res = await request(app).delete("/expense/1")
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ message: "Gasto eliminado correctamente" })
  })
  it("Cuando el id no es un número, la respuesta debe ser un error 400", async () => {
    const res = await request(app).delete("/expense/abc")
    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: "ID inválido" })
  })
})

describe("POST /customCategory", () => {
  let prisma
  beforeEach(() => {
    prisma = mockedPrisma
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
    const res = await request(app).post("/categories/customCategory").send({
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
    const res = await request(app).post("/categories/customCategory").send({
      nombre: "Comida",
      icono: "Wine",
      color: "#FFFFFF",
      descripcion: "Una descripción de comida",
    })
    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: "DB error" })
  })
  it("cuando falta un campo obligatorio, me devuelve un codigo de error 400", async () => {
    const res = await request(app).post("/categories/customCategory").send({
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
    prisma = mockedPrisma
  })
  afterEach(() => {
    jest.clearAllMocks()
  })
  it("Cuando no hay categorias, la respuesta debe ser una lista vacía", async () => {
    prisma.categorias.findMany.mockResolvedValue([])
    prisma.gasto.groupBy.mockResolvedValue([])
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
    prisma.gasto.groupBy.mockResolvedValue([])
    const res = await request(app).get("/categories")
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual(resCategoriasMock)
  })
})

describe("GET /categories (grouping)", () => {
  let prisma
  beforeEach(() => {
    prisma = mockedPrisma
  })
  afterEach(() => {
    jest.clearAllMocks()
  })
  it("Cuando no hay categorias ni gastos, la respuesta debe ser una lista vacía", async () => {
    prisma.categorias.findMany.mockResolvedValue([])
    prisma.gasto.groupBy.mockResolvedValue([])
    const res = await request(app).get("/categories")
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual([])
  })
  it("Cuando hay categorias y gastos, la respuesta debe incluir totalGastos por categoria", async () => {
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
    const sumsMock = [
      {
        categoriaId: 1,
        _sum: { gasto: 300 },
      },
    ]
    prisma.categorias.findMany.mockResolvedValue(categoriasMock)
    prisma.gasto.groupBy.mockResolvedValue(sumsMock)

    const res = await request(app).get("/categories")
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual([
      {
        id: 1,
        nombre: "Comida",
        icono: "Wine",
        color: "#FFFFFF",
        descripcion: "Una descripción de comida",
        totalGastos: 300,
        editable: undefined,
      },
    ])
  })
})

describe("GET /racha/:userId", () => {
  let prisma
  beforeEach(() => {
    prisma = mockedPrisma
  })
  afterEach(() => {
    jest.clearAllMocks()
  })
  it("Cuando un usuario tiene una racha, la respuesta debe incluir esa racha", async () => {
    const rachaMock = [
      {
        usuarioId: 123,
        rachaActual: 3,
        ultimaFecha: Date("1/1/2001"),
        isInactiva: false,
      },
    ]
    prisma.racha.findUnique.mockResolvedValue(rachaMock)
    const res = await request(app).get("/racha/123")
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual([
      {
        usuarioId: 123,
        rachaActual: 3,
        ultimaFecha: Date("1/1/2001"),
        isInactiva: false,
      },
    ])
  })
  it("Cuando un usuario no tiene racha, se debe crear una racha nueva", async () => {
    const rachaMock = {
      usuarioId: 123,
      rachaActual: 0,
      ultimaFecha: new Date("2026-01-01"),
      isInactive: true,
    }

    prisma.racha.findUnique.mockResolvedValue(null)
    prisma.racha.create.mockResolvedValue(rachaMock)

    const res = await request(app).get("/racha/123")
    expect(res.statusCode).toBe(200)
    expect(res.body.usuarioId).toBe(123)
    expect(res.body.rachaActual).toBe(0)
    expect(res.body.isInactive).toBe(true)
  })
  it("Cuando el userId no es válido, la respuesta debe ser un error 400", async () => {
    const res = await request(app).get("/racha/abc")
    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: "userId inválido" })
  })
  it("Cuando ocurre un error inesperado, devuelve 400 y el mensaje de error", async () => {
    prisma.racha.findUnique.mockRejectedValue(new Error("DB error"))

    const res = await request(app).get("/racha/123")

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: "DB error" })
  })
})

const truncateToDate = require("../helpers/truncateToDate")
const { generateCode, hashCode } = require("../helpers/code")
const getRandomObjectives = require("../helpers/getRandomObjectives")
const { generateRefreshToken, hashRefreshToken } = require("../helpers/refresh")

jest.mock("@prisma/client", () => {
  const mPrisma = {
    objetivo: {
      findMany: jest.fn(),
    },
  }
  return {
    PrismaClient: jest.fn(() => mPrisma),
  }
})

const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()

describe("truncateToDate", () => {
  it("deberia truncar la fecha a las 00:00:00", () => {
    const date = new Date("2024-05-15T18:45:30")
    const result = truncateToDate(date)

    expect(result.getHours()).toBe(0)
    expect(result.getMinutes()).toBe(0)
    expect(result.getSeconds()).toBe(0)
    expect(result.getMilliseconds()).toBe(0)
  })
})

describe("generateCode & hashCode", () => {
  it("deberia generar un código hexadecimal de 64 caracteres", () => {
    const code = generateCode()

    expect(code).toMatch(/^[a-f0-9]{64}$/)
  })

  it("deberia hashear correctamente un código", () => {
    const code = "test-code"
    const hash = hashCode(code)

    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it("el hash es determinístico", () => {
    const code = "same-code"

    expect(hashCode(code)).toBe(hashCode(code))
  })
})

describe("generateRefreshToken & hashRefreshToken", () => {
  it("deberia generar un refresh token hexadecimal largo", () => {
    const token = generateRefreshToken()

    expect(token).toMatch(/^[a-f0-9]+$/)
    expect(token.length).toBe(96)
  })

  it("deberia hashear correctamente el refresh token", () => {
    const token = "refresh-token"
    const hash = hashRefreshToken(token)

    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })
})

describe("getRandomObjectives", () => {
  it("deberia devolver la cantidad pedida excluyendo IDs", async () => {
    prisma.objetivo.findMany.mockResolvedValue([
      { id: 1 },
      { id: 2 },
      { id: 3 },
      { id: 4 },
    ])

    const result = await getRandomObjectives(2, [1])

    expect(result).toHaveLength(2)
    result.forEach((obj) => {
      expect(obj.id).not.toBe(1)
    })
  })

  it("deberia lanzar error si no hay suficientes objetivos", async () => {
    prisma.objetivo.findMany.mockResolvedValue([{ id: 1 }])

    await expect(getRandomObjectives(2)).rejects.toThrow(
      "No hay suficientes objetivos",
    )
  })
})

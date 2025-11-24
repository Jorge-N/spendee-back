const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()

async function getRandomObjectives(count) {
  const allObjectives = await prisma.objetivo.findMany()

  if (allObjectives.length < count) {
    throw new Error(
      `No hay suficientes objetivos en la BD: se pidieron ${count}, hay ${allObjectives.length}`,
    )
  }

  const random = allObjectives.sort(() => Math.random() - 0.5).slice(0, count)

  return random
}
module.exports = getRandomObjectives

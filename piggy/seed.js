const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()

async function main() {
  await prisma.objetivo?.deleteMany()
  const objetivos = [
    { descripcion: "Añadir 3 gastos", accion: "expense", maxProgreso: 3 },
    { descripcion: "Añadir 5 ingresos", accion: "income", maxProgreso: 5 },
    {
      descripcion: "Crear 1 categoría nueva",
      accion: "category",
      maxProgreso: 1,
    },
    { descripcion: "Crear 1 presupuesto", accion: "budget", maxProgreso: 1 },
    { descripcion: "Añadir 10 gastos", accion: "expense", maxProgreso: 10 },
    { descripcion: "Añadir 10 ingresos", accion: "income", maxProgreso: 10 },
    {
      descripcion: "Actualizar un presupuesto existente",
      accion: "budget_update",
      maxProgreso: 1,
    },
    {
      descripcion: "Agregar 3 categorías personalizadas",
      accion: "category",
      maxProgreso: 3,
    },
    {
      descripcion: "Registrar 20 movimientos",
      accion: "movement",
      maxProgreso: 20,
    },
    {
      descripcion: "Registrar 50 movimientos",
      accion: "movement",
      maxProgreso: 50,
    },
    {
      descripcion: "Completar 5 objetivos",
      accion: "complete_objectives",
      maxProgreso: 5,
    },
    {
      descripcion: "Eliminar 5 gastos",
      accion: "delete_expense",
      maxProgreso: 5,
    },
    { descripcion: "Crear 2 presupuestos", accion: "budget", maxProgreso: 2 },
    {
      descripcion: "Editar 1 categoría existente",
      accion: "category_edit",
      maxProgreso: 3,
    },
  ]

  for (const obj of objetivos) {
    await prisma.objetivo.create({ data: obj })
  }

  console.log("Seed cargado.")
}

main()

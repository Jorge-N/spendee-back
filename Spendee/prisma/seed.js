import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const defaultCategories = [
  {
    categoria: "Transporte",
    icono: "bus",
    color: "#FF5733",
    descripcion: "Transporte público y privado",
  },
  {
    categoria: "Comida",
    icono: "utensils",
    color: "#33C3FF",
    descripcion: "Alimentos y restaurantes",
  },
  {
    categoria: "Hogar",
    icono: "home",
    color: "#8E44AD",
    descripcion: "Gastos del hogar y servicios",
  },
  {
    categoria: "Salud",
    icono: "heart",
    color: "#E74C3C",
    descripcion: "Medicinas y consultas",
  },
  {
    categoria: "Entretenimiento",
    icono: "gamepad",
    color: "#F1C40F",
    descripcion: "Cine, ocio y suscripciones",
  },
  {
    categoria: "Educación",
    icono: "book",
    color: "#2ECC71",
    descripcion: "Cursos, libros y formación",
  },
  {
    categoria: "Otros",
    icono: "ellipsis-h",
    color: "#95A5A6",
    descripcion: "Gastos varios",
  },
]

await prisma.$executeRawUnsafe(`
    ALTER SEQUENCE "customCategories_id_seq" RESTART WITH 8;
  `)

async function main() {
  for (const cat of defaultCategories) {
    const exists = await prisma.categoriasDefault.findFirst({
      where: { categoria: cat.categoria },
    })
    if (!exists) {
      await prisma.categoriasDefault.create({ data: cat })
      console.log("Inserted", cat.categoria)
    } else {
      console.log("Already exists", cat.categoria)
    }
  }
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

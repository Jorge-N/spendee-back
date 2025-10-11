-- CreateTable
CREATE TABLE "public"."Gasto" (
    "id" SERIAL NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "gasto" DOUBLE PRECISION NOT NULL,
    "montoAnterior" DOUBLE PRECISION NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "categoriaId" INTEGER,

    CONSTRAINT "Gasto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Ingreso" (
    "id" SERIAL NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "ingreso" DECIMAL(65,30) NOT NULL,
    "montoAnterior" DOUBLE PRECISION NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ingreso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CategoriasDefault" (
    "id" SERIAL NOT NULL,
    "categoria" TEXT NOT NULL,
    "icono" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,

    CONSTRAINT "CategoriasDefault_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."customCategories" (
    "id" SERIAL NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "icono" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,

    CONSTRAINT "customCategories_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."Gasto" ADD CONSTRAINT "Gasto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "public"."CategoriasDefault"("id") ON DELETE SET NULL ON UPDATE CASCADE;

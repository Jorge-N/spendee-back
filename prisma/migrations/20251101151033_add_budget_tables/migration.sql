-- CreateTable
CREATE TABLE "Presupuesto" (
    "id" SERIAL NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Presupuesto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresupuestoCategoria" (
    "id" SERIAL NOT NULL,
    "presupuestoId" INTEGER NOT NULL,
    "categoriaId" INTEGER NOT NULL,
    "monto" INTEGER NOT NULL,

    CONSTRAINT "PresupuestoCategoria_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PresupuestoCategoria" ADD CONSTRAINT "PresupuestoCategoria_presupuestoId_fkey" FOREIGN KEY ("presupuestoId") REFERENCES "Presupuesto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresupuestoCategoria" ADD CONSTRAINT "PresupuestoCategoria_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

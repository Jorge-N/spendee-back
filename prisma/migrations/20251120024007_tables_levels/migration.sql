-- CreateTable
CREATE TABLE "Niveles" (
    "id" SERIAL NOT NULL,

    CONSTRAINT "Niveles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Objetivos" (
    "id" SERIAL NOT NULL,
    "descripcion" TEXT NOT NULL,
    "condicion" TEXT NOT NULL,
    "nivelId" INTEGER NOT NULL,

    CONSTRAINT "Objetivos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NivelUsuario" (
    "id" SERIAL NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nivelId" INTEGER NOT NULL,

    CONSTRAINT "NivelUsuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObjetivosUsuario" (
    "id" SERIAL NOT NULL,
    "usuarioNivel" INTEGER NOT NULL,
    "objetivoId" INTEGER NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ObjetivosUsuario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NivelUsuario_usuarioId_key" ON "NivelUsuario"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "ObjetivosUsuario_usuarioNivel_objetivoId_key" ON "ObjetivosUsuario"("usuarioNivel", "objetivoId");

-- AddForeignKey
ALTER TABLE "Objetivos" ADD CONSTRAINT "Objetivos_nivelId_fkey" FOREIGN KEY ("nivelId") REFERENCES "Niveles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NivelUsuario" ADD CONSTRAINT "NivelUsuario_nivelId_fkey" FOREIGN KEY ("nivelId") REFERENCES "Niveles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObjetivosUsuario" ADD CONSTRAINT "ObjetivosUsuario_usuarioNivel_fkey" FOREIGN KEY ("usuarioNivel") REFERENCES "NivelUsuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObjetivosUsuario" ADD CONSTRAINT "ObjetivosUsuario_objetivoId_fkey" FOREIGN KEY ("objetivoId") REFERENCES "Objetivos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

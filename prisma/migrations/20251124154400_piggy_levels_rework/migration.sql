/*
  Warnings:

  - You are about to drop the `NivelUsuario` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Niveles` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Objetivos` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ObjetivosUsuario` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."NivelUsuario" DROP CONSTRAINT "NivelUsuario_nivelId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Objetivos" DROP CONSTRAINT "Objetivos_nivelId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ObjetivosUsuario" DROP CONSTRAINT "ObjetivosUsuario_objetivoId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ObjetivosUsuario" DROP CONSTRAINT "ObjetivosUsuario_usuarioNivel_fkey";

-- DropTable
DROP TABLE "public"."NivelUsuario";

-- DropTable
DROP TABLE "public"."Niveles";

-- DropTable
DROP TABLE "public"."Objetivos";

-- DropTable
DROP TABLE "public"."ObjetivosUsuario";

-- CreateTable
CREATE TABLE "Piggy" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Piggy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Objetivo" (
    "id" SERIAL NOT NULL,
    "descripcion" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "maxProgreso" INTEGER NOT NULL,

    CONSTRAINT "Objetivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObjetivoUsuario" (
    "id" SERIAL NOT NULL,
    "objetivoId" INTEGER NOT NULL,
    "progreso" INTEGER NOT NULL DEFAULT 0,
    "piggyId" TEXT,

    CONSTRAINT "ObjetivoUsuario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Piggy_usuarioId_key" ON "Piggy"("usuarioId");

-- AddForeignKey
ALTER TABLE "ObjetivoUsuario" ADD CONSTRAINT "ObjetivoUsuario_piggyId_fkey" FOREIGN KEY ("piggyId") REFERENCES "Piggy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

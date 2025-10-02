/*
  Warnings:

  - You are about to drop the column `customCategoriaId` on the `Gasto` table. All the data in the column will be lost.
  - You are about to drop the `CategoriasDefault` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `customCategories` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `categoriaId` on table `Gasto` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."Gasto" DROP CONSTRAINT "Gasto_categoriaId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Gasto" DROP CONSTRAINT "Gasto_customCategoriaId_fkey";

-- AlterTable
ALTER TABLE "public"."Gasto" DROP COLUMN "customCategoriaId",
ALTER COLUMN "categoriaId" SET NOT NULL;

-- DropTable
DROP TABLE "public"."CategoriasDefault";

-- DropTable
DROP TABLE "public"."customCategories";

-- CreateTable
CREATE TABLE "public"."Categorias" (
    "id" SERIAL NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "icono" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,

    CONSTRAINT "Categorias_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."Gasto" ADD CONSTRAINT "Gasto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "public"."Categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

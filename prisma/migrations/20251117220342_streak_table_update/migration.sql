/*
  Warnings:

  - The primary key for the `Racha` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `Racha` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[usuarioId]` on the table `Racha` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Racha" DROP CONSTRAINT "Racha_pkey",
DROP COLUMN "id",
ADD CONSTRAINT "Racha_pkey" PRIMARY KEY ("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Racha_usuarioId_key" ON "Racha"("usuarioId");

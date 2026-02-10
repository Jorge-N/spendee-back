/*
  Warnings:

  - Added the required column `nombre` to the `GastoFijo` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "GastoFijo" ADD COLUMN     "nombre" TEXT NOT NULL;

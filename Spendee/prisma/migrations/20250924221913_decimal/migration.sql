/*
  Warnings:

  - You are about to alter the column `ingreso` on the `Ingreso` table. The data in that column could be lost. The data in that column will be cast from `Float` to `Decimal`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Ingreso" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "usuarioId" TEXT NOT NULL,
    "ingreso" DECIMAL NOT NULL,
    "montoAnterior" REAL NOT NULL,
    "fecha" DATETIME NOT NULL
);
INSERT INTO "new_Ingreso" ("fecha", "id", "ingreso", "montoAnterior", "usuarioId") SELECT "fecha", "id", "ingreso", "montoAnterior", "usuarioId" FROM "Ingreso";
DROP TABLE "Ingreso";
ALTER TABLE "new_Ingreso" RENAME TO "Ingreso";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

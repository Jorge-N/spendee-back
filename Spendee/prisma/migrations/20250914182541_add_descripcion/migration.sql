-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Gasto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "usuarioId" TEXT NOT NULL,
    "gasto" REAL NOT NULL,
    "montoAnterior" REAL NOT NULL,
    "fecha" DATETIME NOT NULL
);
INSERT INTO "new_Gasto" ("fecha", "gasto", "id", "montoAnterior", "usuarioId") SELECT "fecha", "gasto", "id", "montoAnterior", "usuarioId" FROM "Gasto";
DROP TABLE "Gasto";
ALTER TABLE "new_Gasto" RENAME TO "Gasto";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

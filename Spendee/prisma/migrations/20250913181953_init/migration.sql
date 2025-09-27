-- CreateTable
CREATE TABLE "Gasto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "usuarioId" INTEGER NOT NULL,
    "gasto" REAL NOT NULL,
    "montoAnterior" REAL NOT NULL,
    "fecha" DATETIME NOT NULL
);

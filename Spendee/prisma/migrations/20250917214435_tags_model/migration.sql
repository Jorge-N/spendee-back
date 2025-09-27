-- CreateTable
CREATE TABLE "Ingreso" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "usuarioId" TEXT NOT NULL,
    "ingreso" REAL NOT NULL,
    "montoAnterior" REAL NOT NULL,
    "fecha" DATETIME NOT NULL
);

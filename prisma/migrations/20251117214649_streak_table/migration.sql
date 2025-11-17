-- CreateTable
CREATE TABLE "Racha" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "rachaActual" INTEGER NOT NULL,
    "ultimaFecha" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Racha_pkey" PRIMARY KEY ("id")
);

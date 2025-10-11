-- AlterTable
ALTER TABLE "public"."Gasto" ADD COLUMN     "customCategoriaId" INTEGER;

-- AddForeignKey
ALTER TABLE "public"."Gasto" ADD CONSTRAINT "Gasto_customCategoriaId_fkey" FOREIGN KEY ("customCategoriaId") REFERENCES "public"."customCategories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

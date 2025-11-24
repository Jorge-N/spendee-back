-- AddForeignKey
ALTER TABLE "ObjetivoUsuario" ADD CONSTRAINT "ObjetivoUsuario_objetivoId_fkey" FOREIGN KEY ("objetivoId") REFERENCES "Objetivo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: coluna nasce anulável para preencher os registros existentes
ALTER TABLE "Cost" ADD COLUMN     "month" TIMESTAMP(3);

-- Registros existentes: primeiro dia do mês atual (fuso de São Paulo), gravado como 00:00 UTC
UPDATE "Cost"
SET "month" = date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo');

ALTER TABLE "Cost" ALTER COLUMN "month" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Cost_bakeryId_month_idx" ON "Cost"("bakeryId", "month");

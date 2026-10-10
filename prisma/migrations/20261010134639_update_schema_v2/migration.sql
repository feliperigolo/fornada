-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'MANAGER');

-- CreateEnum
CREATE TYPE "CostType" AS ENUM ('FIXED', 'VARIABLE', 'LOAN');

-- CreateEnum
CREATE TYPE "Recurrence" AS ENUM ('MONTHLY', 'ANNUAL', 'ONETIME');

-- AlterTable
ALTER TABLE "Recipe" ADD COLUMN     "yieldQty" DECIMAL(14,3),
ADD COLUMN     "yieldUnit" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'OWNER';

-- RenameTable: FixedCost -> Cost (preserves data)
ALTER TABLE "FixedCost" RENAME TO "Cost";
ALTER TABLE "Cost" RENAME CONSTRAINT "FixedCost_pkey" TO "Cost_pkey";
ALTER TABLE "Cost" RENAME CONSTRAINT "FixedCost_bakeryId_fkey" TO "Cost_bakeryId_fkey";
ALTER TABLE "Cost" ADD COLUMN "type" "CostType" NOT NULL DEFAULT 'FIXED',
ADD COLUMN "recurrence" "Recurrence" NOT NULL DEFAULT 'MONTHLY';

-- RenameTable: RecipeIngredient -> RecipeItem (preserves data)
ALTER TABLE "RecipeIngredient" RENAME TO "RecipeItem";
ALTER TABLE "RecipeItem" RENAME CONSTRAINT "RecipeIngredient_pkey" TO "RecipeItem_pkey";
ALTER TABLE "RecipeItem" RENAME CONSTRAINT "RecipeIngredient_recipeId_fkey" TO "RecipeItem_recipeId_fkey";
ALTER TABLE "RecipeItem" RENAME CONSTRAINT "RecipeIngredient_ingredientId_fkey" TO "RecipeItem_ingredientId_fkey";
ALTER TABLE "RecipeItem" ALTER COLUMN "ingredientId" DROP NOT NULL;
ALTER TABLE "RecipeItem" ADD COLUMN "subRecipeId" TEXT;

-- Optional FKs: recreate ingredientId FK as SET NULL (matches Prisma's default for optional relations)
ALTER TABLE "RecipeItem" DROP CONSTRAINT "RecipeItem_ingredientId_fkey";
ALTER TABLE "RecipeItem" ADD CONSTRAINT "RecipeItem_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RecipeItem" ADD CONSTRAINT "RecipeItem_subRecipeId_fkey" FOREIGN KEY ("subRecipeId") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Exactly one of ingredientId / subRecipeId must be set
ALTER TABLE "RecipeItem" ADD CONSTRAINT "RecipeItem_ingredient_xor_subrecipe_check"
  CHECK (("ingredientId" IS NOT NULL) <> ("subRecipeId" IS NOT NULL));

-- CreateTable
CREATE TABLE "MonthlyRevenue" (
    "id" TEXT NOT NULL,
    "bakeryId" TEXT NOT NULL,
    "month" TIMESTAMP(3) NOT NULL,
    "grossRevenue" DECIMAL(12,2) NOT NULL,
    "source" TEXT,
    "xmlRaw" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonthlyRevenue_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "MonthlyRevenue" ADD CONSTRAINT "MonthlyRevenue_bakeryId_fkey" FOREIGN KEY ("bakeryId") REFERENCES "Bakery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

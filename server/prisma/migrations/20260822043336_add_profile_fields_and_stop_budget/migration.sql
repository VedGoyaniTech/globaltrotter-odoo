-- AlterTable
ALTER TABLE "TripStop" ADD COLUMN     "budget" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "bio" TEXT,
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "format" TEXT,
ADD COLUMN     "publicId" TEXT,
ADD COLUMN     "resourceType" TEXT;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "format" TEXT,
ADD COLUMN     "publicId" TEXT,
ADD COLUMN     "resourceType" TEXT;

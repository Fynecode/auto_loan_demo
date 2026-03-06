-- CreateEnum
CREATE TYPE "LoanActivityType" AS ENUM ('CREATED', 'UPDATED', 'STATUS_UPDATED', 'CONTRACT_UPLOADED', 'PENALTY_APPLIED', 'NOTE_ADDED');

-- CreateTable
CREATE TABLE "LoanActivity" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "type" "LoanActivityType" NOT NULL,
    "details" TEXT,
    "performedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoanActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoanActivity_loanId_idx" ON "LoanActivity"("loanId");

-- CreateIndex
CREATE INDEX "LoanActivity_performedBy_idx" ON "LoanActivity"("performedBy");

-- AddForeignKey
ALTER TABLE "LoanActivity" ADD CONSTRAINT "LoanActivity_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanActivity" ADD CONSTRAINT "LoanActivity_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

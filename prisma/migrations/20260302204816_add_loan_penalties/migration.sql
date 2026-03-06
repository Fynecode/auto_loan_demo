-- CreateEnum
CREATE TYPE "LoanPenaltyType" AS ENUM ('INSTALLMENT_INCREASE', 'FULL_REPAYMENT_DEMAND', 'PERIOD_EXTENSION');

-- CreateTable
CREATE TABLE "LoanPenalty" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "type" "LoanPenaltyType" NOT NULL,
    "rate" DECIMAL(5,2) NOT NULL,
    "months" INTEGER NOT NULL,
    "baseMonthlyInstallment" DECIMAL(10,2) NOT NULL,
    "penaltyAmount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoanPenalty_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoanPenalty_loanId_idx" ON "LoanPenalty"("loanId");

-- AddForeignKey
ALTER TABLE "LoanPenalty" ADD CONSTRAINT "LoanPenalty_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

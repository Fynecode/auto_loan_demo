-- AlterTable
ALTER TABLE "Loan" ADD COLUMN     "createdById" TEXT;

-- CreateTable
CREATE TABLE "LoanAssignment" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoanAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoanAssignment_loanId_idx" ON "LoanAssignment"("loanId");

-- CreateIndex
CREATE INDEX "LoanAssignment_userId_idx" ON "LoanAssignment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LoanAssignment_loanId_userId_key" ON "LoanAssignment"("loanId", "userId");

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanAssignment" ADD CONSTRAINT "LoanAssignment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanAssignment" ADD CONSTRAINT "LoanAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

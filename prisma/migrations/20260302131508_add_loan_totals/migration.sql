/*
  Warnings:

  - Added the required column `remainingAmount` to the `Loan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalAmountRepayable` to the `Loan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalInterest` to the `Loan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalMonthlyInstallment` to the `Loan` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Loan" ADD COLUMN     "quantity" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "remainingAmount" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "totalAmountRepayable" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "totalInterest" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "totalMonthlyInstallment" DECIMAL(10,2) NOT NULL;

import type { PrismaClient } from '@prisma/client'

type DuplicateLoanInput = {
  email?: string | null
  idNumber?: string | null
  empNumber?: string | null
  amount: number
  interest: number
  duration: number
  quantity?: number
}

export async function detectDuplicateLoan(
  prisma: PrismaClient,
  input: DuplicateLoanInput
) {
  const clientFilters = [
    input.email ? { email: input.email } : null,
    input.idNumber ? { idNumber: input.idNumber } : null,
    input.empNumber ? { empNumber: input.empNumber } : null
  ].filter(Boolean) as Array<Record<string, string>>

  const where: Record<string, any> = {
    principal: input.amount,
    interestRate: input.interest,
    durationMonths: input.duration
  }

  if (clientFilters.length > 0) {
    where.client = { OR: clientFilters }
  }

  return prisma.loan.findFirst({
    where,
    select: { id: true, reference: true }
  })
}

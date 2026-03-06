import { prisma } from './prisma'

function formatDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

export async function generateLoanReference() {
  const today = new Date()
  const dateKey = formatDateKey(today)
  const prefix = `GL-${dateKey}-`

  const count = await prisma.loan.count({
    where: { reference: { startsWith: prefix } }
  })

  const sequence = String(count + 1).padStart(3, '0')
  return `${prefix}${sequence}`
}

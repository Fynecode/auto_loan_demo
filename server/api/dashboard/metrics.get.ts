import { defineEventHandler, getQuery } from 'h3'
import { prisma } from '~~/server/utils/prisma'
import { requireRole } from '~~/server/utils/requireRole'
import { LoanPenaltyType, LoanStatus } from '~~/app/generated/prisma/client'

type MonthBucket = {
  key: string
  label: string
  start: Date
  end: Date
}

function getMonthBuckets(points: number) {
  const now = new Date()
  const buckets: MonthBucket[] = []
  for (let i = points - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const start = new Date(date.getFullYear(), date.getMonth(), 1)
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 1)
    const label = date.toLocaleString('en-US', { month: 'short', year: '2-digit' })
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    buckets.push({ key, label, start, end })
  }
  return buckets
}

function getMonthBucketsFromRange(start: Date, end: Date) {
  const buckets: MonthBucket[] = []
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
  const endCursor = new Date(end.getFullYear(), end.getMonth(), 1)
  while (cursor <= endCursor) {
    const startDate = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const endDate = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
    const label = cursor.toLocaleString('en-US', { month: 'short', year: '2-digit' })
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
    buckets.push({ key, label, start: startDate, end: endDate })
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return buckets
}

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function sumDecimal(value: any) {
  return Number(value ?? 0)
}

export default defineEventHandler(async (event) => {
  requireRole(event, ['ADMIN'])

  const query = getQuery(event)
  const range = String(query.range ?? 'month')
  const rawLength = Number(query.rangeLength ?? 6)
  const histogram = String(query.histogram ?? 'time')
  const penaltyType = String(query.penaltyType ?? 'all')

  const points = range === 'year' ? 12 : range === 'custom' ? Math.max(rawLength, 1) : 6
  let buckets = getMonthBuckets(points)

  const startDateParam = typeof query.startDate === 'string' ? query.startDate : null
  const endDateParam = typeof query.endDate === 'string' ? query.endDate : null
  if (startDateParam && endDateParam) {
    const start = new Date(startDateParam)
    const end = new Date(endDateParam)
    if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end) {
      buckets = getMonthBucketsFromRange(start, end)
    }
  }
  const startDate = buckets[0]?.start ?? new Date()
  const endDate = buckets[buckets.length - 1]?.end ?? new Date()

  const [activeLoans, overdueLoans, totalOutstandingAgg, overdueAmountAgg, totalPaidAgg, totalExpectedAgg] =
    await Promise.all([
      prisma.loan.count({ where: { status: LoanStatus.ACTIVE } }),
      prisma.loan.count({ where: { status: LoanStatus.OVERDUE } }),
      prisma.loan.aggregate({
        _sum: { remainingAmount: true },
        where: { status: { in: [LoanStatus.ACTIVE, LoanStatus.OVERDUE] } }
      }),
      prisma.loan.aggregate({
        _sum: { remainingAmount: true },
        where: { status: LoanStatus.OVERDUE }
      }),
      prisma.payment.aggregate({ _sum: { amount: true } }),
      prisma.loan.aggregate({ _sum: { totalAmountRepayable: true } })
    ])

  const payments = await prisma.payment.findMany({
    where: { paidAt: { gte: startDate, lt: endDate } },
    select: { amount: true, paidAt: true }
  })

  const loansInRange = await prisma.loan.findMany({
    where: { createdAt: { gte: startDate, lt: endDate } },
    select: { totalAmountRepayable: true, createdAt: true }
  })

  const receivedByMonth = new Map<string, number>()
  const expectedByMonth = new Map<string, number>()

  for (const payment of payments) {
    const key = getMonthKey(payment.paidAt)
    receivedByMonth.set(key, (receivedByMonth.get(key) ?? 0) + sumDecimal(payment.amount))
  }

  for (const loan of loansInRange) {
    const key = getMonthKey(loan.createdAt)
    expectedByMonth.set(key, (expectedByMonth.get(key) ?? 0) + sumDecimal(loan.totalAmountRepayable))
  }

  const revenueSeries = {
    categories: buckets.map((b) => b.label),
    received: buckets.map((b) => Math.round(receivedByMonth.get(b.key) ?? 0)),
    expected: buckets.map((b) => Math.round(expectedByMonth.get(b.key) ?? 0))
  }

  const recentStart = new Date()
  recentStart.setDate(recentStart.getDate() - 30)

  const penaltyWhere: any = {
    createdAt: { gte: recentStart }
  }
  if (penaltyType !== 'all' && Object.values(LoanPenaltyType).includes(penaltyType as LoanPenaltyType)) {
    penaltyWhere.type = penaltyType as LoanPenaltyType
  }

  const recentPenalties = await prisma.loanPenalty.findMany({
    where: penaltyWhere,
    orderBy: { createdAt: 'desc' },
    include: {
      loan: { select: { reference: true } }
    }
  })

  const recentPenaltyAmount = recentPenalties.reduce((sum, item) => sum + sumDecimal(item.penaltyAmount), 0)

  let penaltyScopeWhere: any = {}
  if (histogram === 'time') {
    penaltyScopeWhere = { createdAt: { gte: startDate, lt: endDate } }
  }

  const penalties = await prisma.loanPenalty.findMany({
    where: penaltyScopeWhere,
    include: {
      loan: {
        select: {
          principal: true,
          totalMonthlyInstallment: true
        }
      }
    }
  })

  const typeKeys: LoanPenaltyType[] = [
    LoanPenaltyType.INSTALLMENT_INCREASE,
    LoanPenaltyType.PERIOD_EXTENSION,
    LoanPenaltyType.FULL_REPAYMENT_DEMAND
  ]

  const penaltySeries: Record<string, number[]> = {
    INSTALLMENT_INCREASE: [],
    PERIOD_EXTENSION: [],
    FULL_REPAYMENT_DEMAND: []
  }

  let categories: string[] = []

  if (histogram === 'principal') {
    categories = ['0-2k', '2-5k', '5-8k', '8-12k', '12k+']
    const buckets = [2000, 5000, 8000, 12000]
    for (const type of typeKeys) {
      const counts = new Array(categories.length).fill(0)
      for (const penalty of penalties) {
        if (penalty.type !== type) continue
        const principal = sumDecimal(penalty.loan?.principal)
        const idx = buckets.findIndex((b) => principal < b)
        const bucketIndex = idx === -1 ? categories.length - 1 : idx
        counts[bucketIndex] += 1
      }
      penaltySeries[type] = counts
    }
  } else if (histogram === 'installment') {
    categories = ['0-500', '500-1k', '1k-1.5k', '1.5k-2.5k', '2.5k+']
    const buckets = [500, 1000, 1500, 2500]
    for (const type of typeKeys) {
      const counts = new Array(categories.length).fill(0)
      for (const penalty of penalties) {
        if (penalty.type !== type) continue
        const installment = sumDecimal(penalty.loan?.totalMonthlyInstallment)
        const idx = buckets.findIndex((b) => installment < b)
        const bucketIndex = idx === -1 ? categories.length - 1 : idx
        counts[bucketIndex] += 1
      }
      penaltySeries[type] = counts
    }
  } else {
    categories = buckets.map((b) => b.label)
    const countsByType: Record<string, Record<string, number>> = {
      INSTALLMENT_INCREASE: {},
      PERIOD_EXTENSION: {},
      FULL_REPAYMENT_DEMAND: {}
    }
    for (const penalty of penalties) {
      const key = getMonthKey(penalty.createdAt)
      countsByType[penalty.type][key] = (countsByType[penalty.type][key] ?? 0) + 1
    }
    for (const type of typeKeys) {
      penaltySeries[type] = buckets.map((b) => countsByType[type][b.key] ?? 0)
    }
  }

  return {
    activeLoans,
    overdueLoans,
    totalOutstanding: Math.round(sumDecimal(totalOutstandingAgg._sum.remainingAmount)),
    overdueAmount: Math.round(sumDecimal(overdueAmountAgg._sum.remainingAmount)),
    totalPaid: Math.round(sumDecimal(totalPaidAgg._sum.amount)),
    totalExpected: Math.round(sumDecimal(totalExpectedAgg._sum.totalAmountRepayable)),
    recentPenalties: {
      count: recentPenalties.length,
      amount: Math.round(recentPenaltyAmount)
    },
    recentPenaltiesList: recentPenalties.map((penalty) => ({
      id: penalty.id,
      loanId: penalty.loanId,
      loanReference: penalty.loan?.reference ?? 'Unknown',
      type: penalty.type,
      months: penalty.months,
      rate: Number(penalty.rate),
      penaltyAmount: Math.round(sumDecimal(penalty.penaltyAmount)),
      reason: penalty.reason,
      createdAt: penalty.createdAt.toISOString()
    })),
    revenueSeries,
    penaltySeries: {
      categories,
      series: penaltySeries
    }
  }
})

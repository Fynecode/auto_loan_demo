const CURRENCY_LOCALE = 'en-NA'

export const DEFAULT_DEDUCTION_FEE = 0

type ClientPayload = {
  fullName?: string
  email?: string
  phone?: string
  idNumber?: string
  empNumber?: string
}

type LoanPayload = {
  amount?: number
  duration?: number
  interest?: number
  quantity?: number
  salary?: number
  deduction?: number
  bank?: number
  accountNumber?: number
  branchCode?: number
  deductionFee?: number
}

function round2(value: number) {
  return Math.round(value * 100) / 100
}

function formatCurrency(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return ''
  return new Intl.NumberFormat(CURRENCY_LOCALE, {
    style: 'currency',
    currency: 'NAD',
    minimumFractionDigits: 2
  }).format(value)
}

export function calculateLoanFinancials(
  principal: number,
  interestRate: number,
  durationMonths: number,
  deductionFee: number = DEFAULT_DEDUCTION_FEE
) {
  const months = Number(durationMonths) || 0
  const durationYears = months / 12
  const rate = (Number(interestRate) || 0) / 100
  const principalValue = Number(principal) || 0
  const feeValue = Number(deductionFee) || 0

  const totalInterest = principalValue * rate * durationYears
  const totalAmountRepayable = principalValue + totalInterest + feeValue
  const totalMonthlyInstallment = months > 0 ? totalAmountRepayable / months : 0

  return {
    totalAmountRepayable: round2(totalAmountRepayable),
    totalInterest: round2(totalInterest),
    totalMonthlyInstallment: round2(totalMonthlyInstallment)
  }
}

export function buildContractPayload(
  client: ClientPayload,
  loan: LoanPayload,
  options: { clientNo: number; agrNo: string }
) {
  const principal = Number(loan.amount ?? 0)
  const interestRate = Number(loan.interest ?? 0)
  const durationMonths = Number(loan.duration ?? 0)
  const deductionFee = Number(loan.deductionFee ?? loan.deduction ?? DEFAULT_DEDUCTION_FEE)

  const totals = calculateLoanFinancials(
    principal,
    interestRate,
    durationMonths,
    deductionFee
  )

  const baseFee = durationMonths > 0 ? principal / durationMonths : 0
  const levy = principal * 0.0103

  return {
    clientNo: options.clientNo,
    agrNo: options.agrNo,
    empNo: client.empNumber ?? '',
    idNo: client.idNumber ?? '',
    fullName: client.fullName ?? '',
    amount: round2(principal),
    levy: round2(levy),
    finCharges: round2(totals.totalInterest),
    amountRepay: round2(totals.totalAmountRepayable),
    baseFee: round2(baseFee),
    deduction: round2(deductionFee),
    totalFee: round2(totals.totalMonthlyInstallment),
    period: durationMonths,
    bank: loan.bank ?? '',
    accountNo: loan.accountNumber ?? '',
    branchNo: loan.branchCode ?? '',
    rate: round2(interestRate)
  }
}

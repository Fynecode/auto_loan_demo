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

export async function buildContractPayload(
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
    clientNumber: String(options.clientNo),
    agreementNumber: String(options.agrNo),
    idNumber: client.idNumber ?? '',
    employmentNumber: client.empNumber ?? '',
    clientName: client.fullName ?? '',
    loanAmount: formatCurrency(principal),
    loanPeriod: `${durationMonths} months`,
    interestRate: `${round2(interestRate)}%`,
    principalDebt: formatCurrency(principal),
    totalRepayable: formatCurrency(totals.totalAmountRepayable),
    monthlyInstallment: formatCurrency(totals.totalMonthlyInstallment),
    bankName: loan.bank ?? '',
    accountNumber: String(loan.accountNumber ?? ''),
    branchCode: String(loan.branchCode ?? ''),
    amount: formatCurrency(principal),
    period: durationMonths,
    rate: round2(interestRate),
    levy: formatCurrency(levy),
    bank: loan.bank ?? '',
    accountNo: String(loan.accountNumber ?? ''),
    finCharges: formatCurrency(totals.totalInterest),
    amountRepay: formatCurrency(totals.totalAmountRepayable),
    baseFee: formatCurrency(baseFee),
    deduction: formatCurrency(deductionFee),
    totalFee: formatCurrency(totals.totalMonthlyInstallment)
  }
}

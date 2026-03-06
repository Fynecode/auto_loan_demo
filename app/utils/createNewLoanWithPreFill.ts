type PreFillClient = {
  fullName?: string | null
  email?: string | null
  idNumber?: string | null
  empNumber?: string | null
  phone?: string | null
}

type PreFillLoan = {
  amount?: number | null
  interest?: number | null
  duration?: number | null
  quantity?: number | null
}

export function createNewLoanWithPreFill(
  client?: PreFillClient | null,
  loan?: PreFillLoan | null
) {
  const query: Record<string, string> = {}

  if (client?.fullName) query.fullName = client.fullName
  if (client?.email) query.email = client.email
  if (client?.idNumber) query.idNumber = client.idNumber
  if (client?.empNumber) query.empNumber = client.empNumber
  if (client?.phone) query.phone = client.phone

  if (loan?.amount !== null && loan?.amount !== undefined) query.amount = String(loan.amount)
  if (loan?.interest !== null && loan?.interest !== undefined) query.interest = String(loan.interest)
  if (loan?.duration !== null && loan?.duration !== undefined) query.duration = String(loan.duration)
  if (loan?.quantity !== null && loan?.quantity !== undefined) query.quantity = String(loan.quantity)

  const params = new URLSearchParams(query).toString()
  return params ? `/CreateLoan?${params}` : '/CreateLoan'
}

export function isValidNamibianID(id: string) {
  if (!/^\d{11}$/.test(id)) return false

  const yy = Number(id.slice(0, 2))
  const mm = Number(id.slice(2, 4))
  const dd = Number(id.slice(4, 6))

  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return false

  const currentYear = new Date().getFullYear() % 100
  const century = yy <= currentYear ? 2000 : 1900
  const yyyy = century + yy

  const date = new Date(yyyy, mm - 1, dd)

  return (
    date.getFullYear() === yyyy &&
    date.getMonth() === mm - 1 &&
    date.getDate() === dd
  )
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function isValidNamibianPhone(phone: string) {
  return /^(081|082|083|084|085)\d{7}$/.test(phone)
}

export function hasEmptyFields(values: Record<string, unknown>) {
  return Object.values(values).some(value => {
    if (value === null || value === undefined) return true
    if (typeof value === 'string' && value.trim() === '') return true
    return false
  })
}

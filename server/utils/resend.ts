import { createError } from 'h3'

type LoanContractEmailInput = {
  to: string
  reference: string
  attachmentBuffer: Buffer
}

export async function sendLoanContractEmail({
  to,
  reference,
  attachmentBuffer
}: LoanContractEmailInput) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL || 'no-reply@example.com'

  if (!apiKey) {
    console.warn('RESEND_API_KEY not set; skipping email send.')
    return
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to,
      subject: `Loan contract ${reference}`,
      html: `<p>Your loan contract (${reference}) is attached.</p>`,
      attachments: [
        {
          filename: `${reference}.pdf`,
          content: attachmentBuffer.toString('base64')
        }
      ]
    })
  })

  if (!response.ok) {
    const details = await response.text()
    throw createError({
      statusCode: 502,
      message: `Failed to send contract email: ${details}`
    })
  }
}

type PasswordResetEmailInput = {
  to: string
  resetUrl: string
}

export async function sendPasswordResetEmail({
  to,
  resetUrl
}: PasswordResetEmailInput) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL || 'no-reply@example.com'

  if (!apiKey) {
    console.warn('RESEND_API_KEY not set; skipping password reset email.')
    return
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to,
      subject: 'Password reset',
      html: `<p>Click the link below to reset your password. This link expires in 30 minutes.</p><p><a href="${resetUrl}">${resetUrl}</a></p>`
    })
  })

  if (!response.ok) {
    const details = await response.text()
    throw createError({
      statusCode: 502,
      message: `Failed to send reset email: ${details}`
    })
  }
}

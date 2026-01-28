import { prisma } from '~~/server/utils/prisma'
import { requireAuth } from '~~/server/utils/requireAuth'
import { createError } from 'h3'
import crypto from 'crypto'

export default defineEventHandler(async (event) => {
  await requireAuth(event)

  const body = await readBody(event)

  const {
    firstName,
    lastName,
    email,
    phone,
    idNumber,
    principal,
    interestRate,
    durationMonths,
    startDate
  } = body

  if (!firstName || !lastName || !email || !principal || !interestRate || !durationMonths) {
    throw createError({
      statusCode: 400,
      message: 'Missing required fields'
    })
  }

  const loan = await prisma.loan.create({
    data: {
      reference: crypto.randomUUID(), // or your own ref generator
      principal,
      interestRate,
      durationMonths,
      startDate,
      client: {
        create: {
          firstName,
          lastName,
          email,
          phone,
          idNumber
        }
      }
    },
    include: {
      client: true
    }
  })

  return loan
})
